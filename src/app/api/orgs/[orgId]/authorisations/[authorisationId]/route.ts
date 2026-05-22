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
  assertPayerAuthManager,
  assertPayerAuthReader,
  authorisationInclude,
  getOrgAuthorisationOrThrow,
  validateAuthorisationDates,
} from "@/lib/payer-authorisations";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  payerName: z.string().min(1).max(200).optional(),
  payerType: z.string().max(100).nullable().optional(),
  serviceCode: z.string().max(100).nullable().optional(),
  status: z
    .enum(["active", "pending", "exhausted", "expired", "cancelled"])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  unitsAuthorised: z.number().int().positive().optional(),
  unitType: z.string().max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const GET = withOrgAccess(async (_req: NextRequest, ctx, auth) => {
  try {
    assertPayerAuthReader(auth);
    const row = await getOrgAuthorisationOrThrow(
      auth.orgId!,
      ctx.params.authorisationId,
    );
    return success(row);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PAYER_AUTH_FORBIDDEN") {
        return error("You cannot view payer authorisations", 403);
      }
      if (err.message === "AUTHORISATION_NOT_FOUND") {
        return notFound("Payer authorisation");
      }
    }
    return serverError(err);
  }
});

export const PATCH = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertPayerAuthManager(auth);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await getOrgAuthorisationOrThrow(
      auth.orgId!,
      ctx.params.authorisationId,
    );

    const startDate = parsed.data.startDate
      ? new Date(parsed.data.startDate)
      : existing.startDate;
    const endDate = parsed.data.endDate
      ? new Date(parsed.data.endDate)
      : existing.endDate;
    validateAuthorisationDates(startDate, endDate);

    if (
      parsed.data.unitsAuthorised !== undefined &&
      parsed.data.unitsAuthorised < existing.unitsUsed
    ) {
      return error("Units authorised cannot be less than units already used", 400);
    }

    const updated = await prisma.payerAuthorisation.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.payerName && { payerName: parsed.data.payerName }),
        ...(parsed.data.payerType !== undefined && {
          payerType: parsed.data.payerType,
        }),
        ...(parsed.data.serviceCode !== undefined && {
          serviceCode: parsed.data.serviceCode,
        }),
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.startDate && { startDate }),
        ...(parsed.data.endDate && { endDate }),
        ...(parsed.data.unitsAuthorised !== undefined && {
          unitsAuthorised: parsed.data.unitsAuthorised,
        }),
        ...(parsed.data.unitType && { unitType: parsed.data.unitType }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
      include: authorisationInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "updated",
      resourceType: "payer_authorisation",
      resourceId: updated.id,
      patientId: updated.patientId,
      metadata: { status: updated.status },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PAYER_AUTH_FORBIDDEN") {
        return error("Only billing managers can update authorisations", 403);
      }
      if (err.message === "AUTHORISATION_NOT_FOUND") {
        return notFound("Payer authorisation");
      }
      if (err.message === "AUTHORISATION_INVALID_DATES") {
        return error("End date must be on or after start date", 400);
      }
    }
    return serverError(err);
  }
});

export const DELETE = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertPayerAuthManager(auth);

    const existing = await getOrgAuthorisationOrThrow(
      auth.orgId!,
      ctx.params.authorisationId,
    );

    const claimCount = await prisma.claim.count({
      where: { authorisationId: existing.id, deletedAt: null },
    });
    if (claimCount > 0) {
      return error("Cannot delete an authorisation linked to claims", 409);
    }

    await prisma.payerAuthorisation.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), status: "cancelled" },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "deleted",
      resourceType: "payer_authorisation",
      resourceId: existing.id,
      patientId: existing.patientId,
      req,
    });

    return success({ deleted: true });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PAYER_AUTH_FORBIDDEN") {
        return error("Only billing managers can delete authorisations", 403);
      }
      if (err.message === "AUTHORISATION_NOT_FOUND") {
        return notFound("Payer authorisation");
      }
    }
    return serverError(err);
  }
});
