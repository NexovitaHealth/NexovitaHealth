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
import { claimInclude, createClaimFromApprovedVisit } from "@/lib/billing";

export const dynamic = "force-dynamic";

const createClaimSchema = z.object({
  visitId: z.string().uuid(),
  serviceCode: z.string().min(1).max(100),
  totalAmount: z.number().min(0).optional(),
  units: z.number().int().positive().optional(),
  diagnosisCodes: z.array(z.string().min(1).max(50)).optional(),
  procedureCodes: z.array(z.string().min(1).max(50)).optional(),
  authorisationId: z.string().uuid().optional(),
});

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const { skip, take, page, pageSize } = getPagination(req, 50);
      const status = req.nextUrl.searchParams.get("status") || undefined;
      const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
      const where = {
        orgId: auth.orgId!,
        deletedAt: null,
        ...(status && { status: status as "queued" }),
        ...(patientId && { patientId }),
      };

      const [claims, total] = await Promise.all([
        prisma.claim.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: "desc" },
          include: claimInclude,
        }),
        prisma.claim.count({ where }),
      ]);

      return paginated(claims, total, page, pageSize);
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
      const parsed = createClaimSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const claim = await createClaimFromApprovedVisit(
        auth.orgId!,
        auth.userId,
        parsed.data,
      );

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "created",
        resourceType: "claim",
        resourceId: claim.id,
        patientId: claim.patientId,
        metadata: {
          visitId: claim.visitLogId,
          claimNumber: claim.claimNumber,
          status: claim.status,
          authorisationId: claim.authorisationId,
        },
        req,
      });

      return created(claim);
    } catch (err) {
      if (err instanceof Error) {
        const messages: Record<string, { message: string; status: number }> = {
          VISIT_NOT_FOUND: { message: "Visit not found", status: 404 },
          VISIT_NOT_SUBMITTED: {
            message: "Visit must be submitted and locked before billing",
            status: 409,
          },
          VISIT_NOT_APPROVED: {
            message: "Visit must be approved by nurse review before billing",
            status: 409,
          },
          CLAIM_ALREADY_EXISTS: {
            message: "A claim already exists for this visit",
            status: 409,
          },
          AUTHORISATION_NOT_FOUND: {
            message: "No active payer authorisation covers this visit",
            status: 422,
          },
          AUTHORISATION_INACTIVE: {
            message: "The selected payer authorisation is not active",
            status: 422,
          },
          AUTHORISATION_OUT_OF_RANGE: {
            message: "The selected payer authorisation does not cover the service date",
            status: 422,
          },
          AUTHORISATION_SERVICE_MISMATCH: {
            message: "The selected payer authorisation does not cover this service code",
            status: 422,
          },
          AUTHORISATION_EXHAUSTED: {
            message: "The payer authorisation has no remaining units",
            status: 422,
          },
        };
        const mapped = messages[err.message];
        if (mapped) return error(mapped.message, mapped.status);
      }
      return serverError(err);
    }
  },
  { permission: "billing:manage" },
);
