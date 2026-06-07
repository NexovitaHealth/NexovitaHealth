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
import { patientBranchFilter } from "@/lib/branches";
import { getPagination } from "@/lib/pagination";
import {
  assertClinicalReviewer,
  ensureOrgAssignee,
  ensureVitalInOrg,
  ensureVisitInOrg,
  escalationInclude,
  getOrgPatientOrThrow,
  notifyClinicalEscalation,
} from "@/lib/clinical-reviews";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  patientId: z.string().uuid(),
  category: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  assignedToId: z.string().uuid().optional(),
  sourceVitalId: z.string().uuid().optional(),
  sourceVisitId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
});

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req, 50);
    const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const severity = req.nextUrl.searchParams.get("severity") || undefined;

    const where = {
      orgId: auth.orgId!,
      deletedAt: null,
      ...(patientId && { patientId }),
      ...(status && {
        status: status as "open" | "in_review" | "resolved" | "cancelled",
      }),
      ...(severity && {
        severity: severity as "info" | "warning" | "critical",
      }),
      ...patientBranchFilter(auth.activeBranchId, auth.orgHasBranches),
    };

    const [escalations, total] = await Promise.all([
      prisma.escalation.findMany({
        where,
        skip,
        take,
        orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
        include: escalationInclude,
      }),
      prisma.escalation.count({ where }),
    ]);

    return paginated(escalations, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
  },
  { permission: "escalation:read" },
);

export const POST = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
  try {
    assertClinicalReviewer(auth);

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data;

    const escalation = await prisma.$transaction(async (tx) => {
      const patient = await getOrgPatientOrThrow(auth.orgId!, data.patientId, tx);
      await ensureOrgAssignee(auth.orgId!, data.assignedToId, tx);
      await ensureVitalInOrg(auth.orgId!, data.sourceVitalId, patient.id, tx);
      await ensureVisitInOrg(auth.orgId!, data.sourceVisitId, patient.id, tx);

      if (data.incidentId) {
        const incident = await tx.incident.findFirst({
          where: {
            id: data.incidentId,
            orgId: auth.orgId!,
            patientId: patient.id,
            deletedAt: null,
          },
        });
        if (!incident) throw new Error("INCIDENT_NOT_FOUND");
      }

      return tx.escalation.create({
        data: {
          orgId: auth.orgId!,
          patientId: patient.id,
          createdById: auth.userId,
          assignedToId: data.assignedToId,
          category: data.category,
          title: data.title,
          description: data.description,
          severity: data.severity,
          sourceVitalId: data.sourceVitalId,
          sourceVisitId: data.sourceVisitId,
          incidentId: data.incidentId,
          status: data.assignedToId ? "in_review" : "open",
        },
        include: escalationInclude,
      });
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "escalation",
      resourceId: escalation.id,
      patientId: escalation.patientId,
      metadata: { severity: escalation.severity, category: escalation.category },
      req,
    });

    await notifyClinicalEscalation({
      orgId: auth.orgId!,
      patientId: escalation.patientId,
      patientName: escalation.patient.fullName,
      escalationId: escalation.id,
      title: escalation.title,
      severity: escalation.severity,
      actorName: auth.user.fullName,
    });

    return created(escalation);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "REVIEW_FORBIDDEN") {
        return error("Only clinical reviewers can manage escalations", 403);
      }
      if (err.message === "PATIENT_NOT_FOUND") return error("Patient not found", 404);
      if (err.message === "ASSIGNEE_NOT_IN_ORG") {
        return error("Assignee must belong to this organization", 400);
      }
      if (err.message === "VISIT_NOT_FOUND") return error("Visit not found", 404);
      if (err.message === "VITAL_NOT_FOUND") return error("Vital reading not found", 404);
      if (err.message === "INCIDENT_NOT_FOUND") return error("Incident not found", 404);
    }
    return serverError(err);
  }
  },
  { permission: "escalation:manage" },
);
