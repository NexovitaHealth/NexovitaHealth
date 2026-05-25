import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { buildClaimAuditEvent } from "@/lib/audit-events";
import {
  error,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { claimInclude, getClaimStatusTimestamps } from "@/lib/billing";
import { recordClaimPayment } from "@/lib/claim-payments";

export const dynamic = "force-dynamic";

const updateClaimSchema = z.object({
  status: z.enum(["queued", "submitted", "paid", "denied", "voided"]).optional(),
  denialReason: z.string().max(1000).optional(),
  paymentReference: z.string().max(200).optional(),
  paymentMethod: z.string().max(100).optional(),
  paidAmount: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const GET = withOrgAccess(
  async (_req: NextRequest, ctx, auth) => {
    try {
      const claim = await prisma.claim.findFirst({
        where: {
          id: ctx.params.claimId,
          orgId: auth.orgId!,
          deletedAt: null,
        },
        include: claimInclude,
      });
      if (!claim) return notFound("Claim");

      return success(claim);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "billing:read" },
);

export const PATCH = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      const body = await req.json();
      const parsed = updateClaimSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      if (parsed.data.status === "denied" && !parsed.data.denialReason) {
        return error("A denial reason is required when denying a claim", 422);
      }

      const claim = await prisma.claim.findFirst({
        where: {
          id: ctx.params.claimId,
          orgId: auth.orgId!,
          deletedAt: null,
        },
      });
      if (!claim) return notFound("Claim");
      if (claim.status === "voided") {
        return error("Voided claims cannot be updated", 409);
      }

      const voidRestoresAuth =
        parsed.data.status === "voided" && !!claim.authorisationId;
      const shouldRecordPayment =
        parsed.data.paidAmount !== undefined &&
        parsed.data.paidAmount > 0 &&
        parsed.data.status !== "voided";

      const updated = await prisma.$transaction(async (tx) => {
        if (voidRestoresAuth) {
          await tx.payerAuthorisation.update({
            where: { id: claim.authorisationId! },
            data: {
              unitsUsed: { decrement: claim.units },
              status: "active",
            },
          });
        }

        if (shouldRecordPayment) {
          await recordClaimPayment(
            {
              orgId: auth.orgId!,
              claimId: claim.id,
              recordedById: auth.userId,
              amount: parsed.data.paidAmount!,
              paymentReference: parsed.data.paymentReference,
              paymentMethod: parsed.data.paymentMethod,
            },
            tx,
          );
        }

        const nextStatus = parsed.data.status ?? claim.status;
        const existingMeta =
          claim.metadata && typeof claim.metadata === "object"
            ? (claim.metadata as Record<string, unknown>)
            : {};

        return tx.claim.update({
          where: { id: claim.id },
          data: {
            status: parsed.data.status,
            denialReason: parsed.data.denialReason,
            totalAmount:
              nextStatus === "paid" && parsed.data.paidAmount !== undefined
                ? parsed.data.paidAmount
                : undefined,
            metadata: {
              ...existingMeta,
              ...(parsed.data.metadata ?? {}),
              ...(parsed.data.paymentReference && {
                paymentReference: parsed.data.paymentReference,
              }),
              ...(parsed.data.paidAmount !== undefined && {
                paidAmount: parsed.data.paidAmount,
              }),
            } as Prisma.InputJsonValue,
            ...getClaimStatusTimestamps(nextStatus),
          },
          include: claimInclude,
        });
      });

      const auditEvent = buildClaimAuditEvent(claim, updated, parsed.data, {
        unitsRestoredOnVoid: voidRestoresAuth ? claim.units : undefined,
      });

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: auditEvent.action,
        resourceType: "claim",
        resourceId: claim.id,
        patientId: claim.patientId,
        metadata: auditEvent.metadata,
        req,
      });

      return success(updated);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "billing:manage" },
);
