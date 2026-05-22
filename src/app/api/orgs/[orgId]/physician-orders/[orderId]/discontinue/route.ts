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

const discontinueOrderSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertCarePlanEditor(auth.user.role);

    const order = await getOrgPhysicianOrderOrThrow(
      auth.orgId!,
      ctx.params.orderId,
    );
    if (["discontinued", "cancelled", "completed"].includes(order.status)) {
      return error("Physician order is already closed", 409);
    }

    const body = await req.json();
    const parsed = discontinueOrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const metadata =
      order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
        ? (order.metadata as Record<string, unknown>)
        : {};

    const updated = await prisma.physicianOrder.update({
      where: { id: order.id },
      data: {
        status: "discontinued",
        discontinuedAt: new Date(),
        metadata: {
          ...metadata,
          discontinuationReason: parsed.data.reason,
          discontinuedById: auth.userId,
        } as Prisma.InputJsonValue,
      },
      include: physicianOrderInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "status_changed",
      resourceType: "physician_order",
      resourceId: updated.id,
      patientId: updated.patientId,
      metadata: {
        status: updated.status,
        reason: parsed.data.reason,
      },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CARE_PLAN_FORBIDDEN") {
        return error("Only clinical users can discontinue physician orders", 403);
      }
      if (err.message === "PHYSICIAN_ORDER_NOT_FOUND") {
        return notFound("Physician order");
      }
    }
    return serverError(err);
  }
});
