import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  error,
  serverError,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { getPagination } from "@/lib/pagination";
import {
  assertCarePlanEditor,
  carePlanInclude,
  getOrgPatientOrThrow,
  listOrgCarePlans,
} from "@/lib/care-plans";

export const dynamic = "force-dynamic";

const carePlanSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string().min(1).max(200),
  goals: z.array(z.unknown()).default([]),
  interventions: z.array(z.unknown()).default([]),
  status: z.enum(["draft", "active"]).default("draft"),
  startDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
});

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const { page, pageSize } = getPagination(req, 50);
      const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
      const status = req.nextUrl.searchParams.get("status") || undefined;
      const search = req.nextUrl.searchParams.get("search") || undefined;
      const unsignedOnly =
        req.nextUrl.searchParams.get("unsignedOnly") === "true";

      const { items, total, meta } = await listOrgCarePlans(auth.orgId!, {
        page,
        pageSize,
        patientId,
        status,
        search,
        unsignedOnly,
        branchId: auth.activeBranchId,
        orgHasBranches: auth.orgHasBranches,
      });

      return NextResponse.json({
        success: true,
        data: items,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
          hasMore: page * pageSize < total,
        },
        meta,
      });
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "careplan:read" },
);

export const POST = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    assertCarePlanEditor(auth.user.role);

    const body = await req.json();
    const parsed = carePlanSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data;
    const patient = await getOrgPatientOrThrow(auth.orgId!, data.patientId);
    const carePlan = await prisma.carePlan.create({
      data: {
        orgId: auth.orgId!,
        patientId: patient.id,
        authorId: auth.userId,
        title: data.title,
        goals: data.goals as Prisma.InputJsonValue,
        interventions: data.interventions as Prisma.InputJsonValue,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : undefined,
      },
      include: carePlanInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "care_plan",
      resourceId: carePlan.id,
      patientId: carePlan.patientId,
      metadata: { status: carePlan.status, version: carePlan.version },
      req,
    });

    return created(carePlan);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CARE_PLAN_FORBIDDEN") {
        return error("Only clinical users can manage care plans", 403);
      }
      if (err.message === "PATIENT_NOT_FOUND") {
        return error("Patient is not available in this organization", 404);
      }
    }
    return serverError(err);
  }
});
