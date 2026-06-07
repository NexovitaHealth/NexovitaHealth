import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
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
import { patientBranchFilter } from "@/lib/branches";
import { getPagination } from "@/lib/pagination";
import {
  assertCarePlanEditor,
  ensureCarePlanBelongsToPatient,
  ensureEscalationBelongsToPatient,
  ensureOrgPhysician,
  getOrgPatientOrThrow,
  physicianOrderInclude,
} from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const createPhysicianOrderSchema = z.object({
  patientId: z.string().uuid(),
  physicianId: z.string().uuid().optional(),
  carePlanId: z.string().uuid().optional(),
  escalationId: z.string().uuid().optional(),
  orderType: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  instructions: z.string().min(1).max(4000),
  status: z.enum(["draft", "active"]).default("draft"),
  effectiveAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req, 50);
    const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
    const physicianId = req.nextUrl.searchParams.get("physicianId") || undefined;
    const carePlanId = req.nextUrl.searchParams.get("carePlanId") || undefined;
    const status = req.nextUrl.searchParams.get("status") || undefined;

    const where = {
      orgId: auth.orgId!,
      deletedAt: null,
      ...(patientId && { patientId }),
      ...(physicianId && { physicianId }),
      ...(carePlanId && { carePlanId }),
      ...(status && { status: status as "draft" }),
      ...patientBranchFilter(auth.activeBranchId, auth.orgHasBranches),
    };

    const [orders, total] = await Promise.all([
      prisma.physicianOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: physicianOrderInclude,
      }),
      prisma.physicianOrder.count({ where }),
    ]);

    return paginated(orders, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
  },
  { permission: "physician_order:manage" },
);

export const POST = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
  try {
    assertCarePlanEditor(auth.user.role);

    const body = await req.json();
    const parsed = createPhysicianOrderSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data;
    const physicianId = data.physicianId ?? auth.userId;

    const order = await prisma.$transaction(async (tx) => {
      const patient = await getOrgPatientOrThrow(auth.orgId!, data.patientId, tx);
      await ensureOrgPhysician(auth.orgId!, physicianId, tx);
      await ensureCarePlanBelongsToPatient(
        auth.orgId!,
        data.carePlanId,
        patient.id,
        tx,
      );
      await ensureEscalationBelongsToPatient(
        auth.orgId!,
        data.escalationId,
        patient.id,
        tx,
      );

      return tx.physicianOrder.create({
        data: {
          orgId: auth.orgId!,
          patientId: patient.id,
          physicianId,
          carePlanId: data.carePlanId,
          escalationId: data.escalationId,
          orderType: data.orderType,
          title: data.title,
          instructions: data.instructions,
          status: data.status,
          effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : undefined,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
        },
        include: physicianOrderInclude,
      });
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "physician_order",
      resourceId: order.id,
      patientId: order.patientId,
      metadata: {
        status: order.status,
        physicianId: order.physicianId,
        carePlanId: order.carePlanId,
      },
      req,
    });

    return created(order);
  } catch (err) {
    if (err instanceof Error) {
      const errors: Record<string, { message: string; status: number }> = {
        CARE_PLAN_FORBIDDEN: {
          message: "Only clinical users can create physician orders",
          status: 403,
        },
        PATIENT_NOT_FOUND: {
          message: "Patient is not available in this organization",
          status: 404,
        },
        PHYSICIAN_NOT_IN_ORG: {
          message: "Assigned physician must belong to this organization",
          status: 400,
        },
        CARE_PLAN_NOT_FOUND: {
          message: "Care plan is not available for this patient",
          status: 404,
        },
        ESCALATION_NOT_FOUND: {
          message: "Escalation is not available for this patient",
          status: 404,
        },
      };
      const mapped = errors[err.message];
      if (mapped) return error(mapped.message, mapped.status);
    }
    return serverError(err);
  }
  },
  { permission: "physician_order:manage" },
);
