import { NextRequest } from "next/server";
import { z } from "zod";
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
  assertPhysician,
  getOrgPhysicianOrderOrThrow,
  physicianOrderInclude,
  signatureHash,
} from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const signOrderSchema = z.object({
  signatureMeaning: z
    .string()
    .max(240)
    .default("Physician signature: I authorize this order."),
});

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertPhysician(auth.user.role);

    const order = await getOrgPhysicianOrderOrThrow(
      auth.orgId!,
      ctx.params.orderId,
    );
    if (order.physicianId !== auth.userId) {
      return error("Only the assigned physician can sign this order", 403);
    }
    if (order.signedAt) return error("Physician order is already signed", 409);
    if (order.status !== "draft") {
      return error("Only draft physician orders can be signed", 409);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = signOrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const signedAt = new Date();
    const updated = await prisma.physicianOrder.update({
      where: { id: order.id },
      data: {
        status: "active",
        signedAt,
        signatureMeaning: parsed.data.signatureMeaning,
        signatureHash: signatureHash({
          resourceId: order.id,
          signerId: auth.userId,
          signedAt,
          meaning: parsed.data.signatureMeaning,
        }),
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
        signedAt,
        signatureHash: updated.signatureHash,
      },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PHYSICIAN_SIGNATURE_REQUIRED") {
        return error("Only physicians can sign physician orders", 403);
      }
      if (err.message === "PHYSICIAN_ORDER_NOT_FOUND") {
        return notFound("Physician order");
      }
    }
    return serverError(err);
  }
});
