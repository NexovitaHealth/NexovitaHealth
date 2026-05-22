import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  assertCarePlanEditor,
  carePlanInclude,
  ensureCarePlanMutable,
  getOrgCarePlanOrThrow,
} from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const updateCarePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  goals: z.array(z.unknown()).optional(),
  interventions: z.array(z.unknown()).optional(),
  status: z
    .enum(["draft", "active", "superseded", "expired", "discontinued"])
    .optional(),
  startDate: z.string().datetime().nullable().optional(),
  reviewDate: z.string().datetime().nullable().optional(),
});

export const GET = withOrgAccess(async (_req: NextRequest, ctx, auth) => {
  try {
    const carePlan = await getOrgCarePlanOrThrow(
      auth.orgId!,
      ctx.params.carePlanId,
    );
    return success(carePlan);
  } catch (err) {
    if (err instanceof Error && err.message === "CARE_PLAN_NOT_FOUND") {
      return notFound("Care plan");
    }
    return serverError(err);
  }
});

export const PATCH = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertCarePlanEditor(auth.user.role);

    const carePlan = await getOrgCarePlanOrThrow(
      auth.orgId!,
      ctx.params.carePlanId,
    );
    ensureCarePlanMutable(carePlan);

    const body = await req.json();
    const parsed = updateCarePlanSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.carePlan.update({
      where: { id: carePlan.id },
      data: {
        title: parsed.data.title,
        goals: parsed.data.goals as Prisma.InputJsonValue | undefined,
        interventions: parsed.data.interventions as
          | Prisma.InputJsonValue
          | undefined,
        status: parsed.data.status,
        startDate:
          parsed.data.startDate === undefined
            ? undefined
            : parsed.data.startDate
              ? new Date(parsed.data.startDate)
              : null,
        reviewDate:
          parsed.data.reviewDate === undefined
            ? undefined
            : parsed.data.reviewDate
              ? new Date(parsed.data.reviewDate)
              : null,
      },
      include: carePlanInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: parsed.data.status ? "status_changed" : "updated",
      resourceType: "care_plan",
      resourceId: updated.id,
      patientId: updated.patientId,
      metadata: { changes: parsed.data },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CARE_PLAN_FORBIDDEN") {
        return error("Only clinical users can update care plans", 403);
      }
      if (err.message === "CARE_PLAN_NOT_FOUND") return notFound("Care plan");
      if (err.message === "CARE_PLAN_SIGNED") {
        return error("Signed care plans cannot be edited; create a renewal instead", 409);
      }
    }
    return serverError(err);
  }
});

export const DELETE = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertCarePlanEditor(auth.user.role);

    const carePlan = await getOrgCarePlanOrThrow(
      auth.orgId!,
      ctx.params.carePlanId,
    );

    const deleted = await prisma.carePlan.update({
      where: { id: carePlan.id },
      data: { deletedAt: new Date(), status: "discontinued" },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "deleted",
      resourceType: "care_plan",
      resourceId: deleted.id,
      patientId: deleted.patientId,
      req,
    });

    return success({ deleted: true });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CARE_PLAN_FORBIDDEN") {
        return error("Only clinical users can delete care plans", 403);
      }
      if (err.message === "CARE_PLAN_NOT_FOUND") return notFound("Care plan");
    }
    return serverError(err);
  }
});
