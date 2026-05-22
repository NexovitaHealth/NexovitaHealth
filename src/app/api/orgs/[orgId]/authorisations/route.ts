import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  error,
  paginated,
  serverError,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { getPagination } from "@/lib/pagination";
import {
  assertPayerAuthManager,
  assertPayerAuthReader,
  authorisationInclude,
  getOrgPatientOrThrow,
  syncExpiredAuthorisations,
  validateAuthorisationDates,
} from "@/lib/payer-authorisations";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  patientId: z.string().uuid(),
  payerName: z.string().min(1).max(200),
  payerType: z.string().max(100).optional(),
  authorisationNumber: z.string().min(1).max(100),
  serviceCode: z.string().max(100).optional(),
  status: z
    .enum(["active", "pending", "exhausted", "expired", "cancelled"])
    .default("pending"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  unitsAuthorised: z.number().int().positive(),
  unitType: z.string().max(50).default("visit"),
  notes: z.string().max(2000).optional(),
});

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
  try {
    await syncExpiredAuthorisations(auth.orgId!);

    const { skip, take, page, pageSize } = getPagination(req, 50);
    const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
    const status = req.nextUrl.searchParams.get("status") || undefined;

    const where = {
      orgId: auth.orgId!,
      deletedAt: null,
      ...(patientId && { patientId }),
      ...(status && {
        status: status as "active" | "pending" | "exhausted" | "expired" | "cancelled",
      }),
    };

    const [items, total] = await Promise.all([
      prisma.payerAuthorisation.findMany({
        where,
        skip,
        take,
        orderBy: [{ status: "asc" }, { endDate: "asc" }],
        include: authorisationInclude,
      }),
      prisma.payerAuthorisation.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
},
  { permission: "billing:read" },
);

export const POST = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data;
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    validateAuthorisationDates(startDate, endDate);

    const authorisation = await prisma.$transaction(async (tx) => {
      await getOrgPatientOrThrow(auth.orgId!, data.patientId, tx);

      const existing = await tx.payerAuthorisation.findFirst({
        where: {
          orgId: auth.orgId!,
          authorisationNumber: data.authorisationNumber,
          deletedAt: null,
        },
      });
      if (existing) throw new Error("AUTHORISATION_NUMBER_EXISTS");

      return tx.payerAuthorisation.create({
        data: {
          orgId: auth.orgId!,
          patientId: data.patientId,
          payerName: data.payerName,
          payerType: data.payerType,
          authorisationNumber: data.authorisationNumber,
          serviceCode: data.serviceCode,
          status: data.status,
          startDate,
          endDate,
          unitsAuthorised: data.unitsAuthorised,
          unitType: data.unitType,
          notes: data.notes,
        },
        include: authorisationInclude,
      });
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "payer_authorisation",
      resourceId: authorisation.id,
      patientId: authorisation.patientId,
      metadata: {
        authorisationNumber: authorisation.authorisationNumber,
        payerName: authorisation.payerName,
      },
      req,
    });

    return created(authorisation);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PAYER_AUTH_FORBIDDEN") {
        return error("Only billing managers can create authorisations", 403);
      }
      if (err.message === "PATIENT_NOT_FOUND") return error("Patient not found", 404);
      if (err.message === "AUTHORISATION_INVALID_DATES") {
        return error("End date must be on or after start date", 400);
      }
      if (err.message === "AUTHORISATION_NUMBER_EXISTS") {
        return error("Authorisation number already exists for this organization", 409);
      }
    }
    return serverError(err);
  }
},
  { permission: "authorisation:manage" },
);
