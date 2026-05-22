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
  getOrgPhysicianOrderOrThrow,
  physicianOrderInclude,
} from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const updatePhysicianOrderSchema = z.object({
  orderType: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200).optional(),
  instructions: z.string().min(1).max(4000).optional(),
  status: z
    .enum(["draft", "active", "completed", "discontinued", "cancelled"])
    .optional(),
  effectiveAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const GET = withOrgAccess(async (_req: NextRequest, ctx, auth) => {
  try {
    const order = await getOrgPhysicianOrderOrThrow(
      auth.orgId!,
      ctx.params.orderId,
    );
    return success(order);
  } catch (err) {
    if (err instanceof Error && err.message === "PHYSICIAN_ORDER_NOT_FOUND") {
      return notFound("Physician order");
    }
    return serverError(err);
  }
});

export const PATCH = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertCarePlanEditor(auth.user.role);

    const order = await getOrgPhysicianOrderOrThrow(
      auth.orgId!,
      ctx.params.orderId,
    );

    const body = await req.json();
    if (order.signedAt && parsedBodyTouchesClinicalFields(body)) {
      return error("Signed physician orders cannot change clinical instructions", 409);
    }

    const parsed = updatePhysicianOrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.physicianOrder.update({
      where: { id: order.id },
      data: {
        orderType: parsed.data.orderType,
        title: parsed.data.title,
        instructions: parsed.data.instructions,
        status: parsed.data.status,
        effectiveAt:
          parsed.data.effectiveAt === undefined
            ? undefined
            : parsed.data.effectiveAt
              ? new Date(parsed.data.effectiveAt)
              : null,
        expiresAt:
          parsed.data.expiresAt === undefined
            ? undefined
            : parsed.data.expiresAt
              ? new Date(parsed.data.expiresAt)
              : null,
        discontinuedAt:
          parsed.data.status === "discontinued" ? new Date() : undefined,
        metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
      },
      include: physicianOrderInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: parsed.data.status ? "status_changed" : "updated",
      resourceType: "physician_order",
      resourceId: updated.id,
      patientId: updated.patientId,
      metadata: { changes: parsed.data },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CARE_PLAN_FORBIDDEN") {
        return error("Only clinical users can update physician orders", 403);
      }
      if (err.message === "PHYSICIAN_ORDER_NOT_FOUND") {
        return notFound("Physician order");
      }
    }
    return serverError(err);
  }
});

function parsedBodyTouchesClinicalFields(body: unknown) {
  if (!body || typeof body !== "object") return false;
  return ["orderType", "title", "instructions", "effectiveAt", "expiresAt"].some(
    (field) => field in body,
  );
}
