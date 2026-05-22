import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  error,
  notFound,
  serverError,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  assertCarePlanEditor,
  carePlanInclude,
  getOrgCarePlanOrThrow,
} from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const renewCarePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  goals: z.array(z.unknown()).optional(),
  interventions: z.array(z.unknown()).optional(),
  startDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
});

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertCarePlanEditor(auth.user.role);

    const existing = await getOrgCarePlanOrThrow(
      auth.orgId!,
      ctx.params.carePlanId,
    );
    const body = await req.json();
    const parsed = renewCarePlanSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const renewed = await prisma.$transaction(async (tx) => {
      await tx.carePlan.update({
        where: { id: existing.id },
        data: { status: "superseded" },
      });

      return tx.carePlan.create({
        data: {
          orgId: auth.orgId!,
          patientId: existing.patientId,
          authorId: auth.userId,
          parentCarePlanId: existing.id,
          title: parsed.data.title ?? existing.title,
          goals: (parsed.data.goals ?? existing.goals) as Prisma.InputJsonValue,
          interventions: (parsed.data.interventions ??
            existing.interventions) as Prisma.InputJsonValue,
          status: "draft",
          version: existing.version + 1,
          startDate: parsed.data.startDate
            ? new Date(parsed.data.startDate)
            : new Date(),
          reviewDate: parsed.data.reviewDate
            ? new Date(parsed.data.reviewDate)
            : existing.reviewDate,
        },
        include: carePlanInclude,
      });
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "care_plan",
      resourceId: renewed.id,
      patientId: renewed.patientId,
      metadata: {
        renewedFromCarePlanId: existing.id,
        version: renewed.version,
      },
      req,
    });

    return created(renewed);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CARE_PLAN_FORBIDDEN") {
        return error("Only clinical users can renew care plans", 403);
      }
      if (err.message === "CARE_PLAN_NOT_FOUND") return notFound("Care plan");
    }
    return serverError(err);
  }
});
