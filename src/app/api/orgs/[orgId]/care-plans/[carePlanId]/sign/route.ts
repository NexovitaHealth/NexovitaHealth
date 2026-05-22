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
  carePlanInclude,
  getOrgCarePlanOrThrow,
  signatureHash,
} from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const signCarePlanSchema = z.object({
  signatureMeaning: z
    .string()
    .max(240)
    .default("Physician signature: I approve this care plan."),
});

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertPhysician(auth.user.role);

    const carePlan = await getOrgCarePlanOrThrow(
      auth.orgId!,
      ctx.params.carePlanId,
    );
    if (carePlan.signedAt) return error("Care plan is already signed", 409);

    const body = await req.json().catch(() => ({}));
    const parsed = signCarePlanSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const signedAt = new Date();
    const updated = await prisma.carePlan.update({
      where: { id: carePlan.id },
      data: {
        status: "active",
        signedAt,
        signedById: auth.userId,
        signatureMeaning: parsed.data.signatureMeaning,
        signatureHash: signatureHash({
          resourceId: carePlan.id,
          signerId: auth.userId,
          signedAt,
          meaning: parsed.data.signatureMeaning,
        }),
      },
      include: carePlanInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "status_changed",
      resourceType: "care_plan",
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
        return error("Only physicians can sign care plans", 403);
      }
      if (err.message === "CARE_PLAN_NOT_FOUND") return notFound("Care plan");
    }
    return serverError(err);
  }
});
