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
  assertIncidentReporter,
  ensureOrgAssignee,
  ensureVisitInOrg,
  getOrgPatientOrThrow,
  incidentInclude,
  notifyIncidentReported,
} from "@/lib/clinical-reviews";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  patientId: z.string().uuid(),
  incidentType: z.string().min(1).max(100),
  description: z.string().min(1).max(4000),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  occurredAt: z.string().datetime(),
  visitLogId: z.string().uuid().optional(),
  immediateAction: z.string().max(2000).optional(),
  assignedToId: z.string().uuid().optional(),
  createEscalation: z.boolean().default(true),
});

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
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
        status: status as "reported" | "triaged" | "resolved" | "closed",
      }),
      ...(severity && {
        severity: severity as "info" | "warning" | "critical",
      }),
    };

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        skip,
        take,
        orderBy: [{ status: "asc" }, { severity: "desc" }, { occurredAt: "desc" }],
        include: incidentInclude,
      }),
      prisma.incident.count({ where }),
    ]);

    return paginated(incidents, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
});

export const POST = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    assertIncidentReporter(auth.user.role);

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const patient = await getOrgPatientOrThrow(auth.orgId!, data.patientId, tx);
      await ensureOrgAssignee(auth.orgId!, data.assignedToId, tx);
      await ensureVisitInOrg(auth.orgId!, data.visitLogId, patient.id, tx);

      const incident = await tx.incident.create({
        data: {
          orgId: auth.orgId!,
          patientId: patient.id,
          reportedById: auth.userId,
          assignedToId: data.assignedToId,
          visitLogId: data.visitLogId,
          incidentType: data.incidentType,
          description: data.description,
          severity: data.severity,
          occurredAt: new Date(data.occurredAt),
          immediateAction: data.immediateAction,
          status: data.assignedToId ? "triaged" : "reported",
        },
        include: incidentInclude,
      });

      let escalation = null;
      if (
        data.createEscalation &&
        (data.severity === "critical" || data.severity === "warning")
      ) {
        escalation = await tx.escalation.create({
          data: {
            orgId: auth.orgId!,
            patientId: patient.id,
            createdById: auth.userId,
            assignedToId: data.assignedToId,
            incidentId: incident.id,
            category: "incident",
            title: `Incident: ${data.incidentType}`,
            description: data.description,
            severity: data.severity,
            sourceVisitId: data.visitLogId,
            status: data.assignedToId ? "in_review" : "open",
          },
          select: { id: true, title: true },
        });
      }

      return { incident, escalation };
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "incident",
      resourceId: result.incident.id,
      patientId: result.incident.patientId,
      metadata: {
        incidentType: result.incident.incidentType,
        severity: result.incident.severity,
        escalationId: result.escalation?.id,
      },
      req,
    });

    await notifyIncidentReported({
      orgId: auth.orgId!,
      patientId: result.incident.patientId,
      patientName: result.incident.patient.fullName,
      incidentId: result.incident.id,
      incidentType: result.incident.incidentType,
      severity: result.incident.severity,
      reporterName: auth.user.fullName,
    });

    return created(result.incident);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INCIDENT_FORBIDDEN") {
        return error("Your role cannot report incidents", 403);
      }
      if (err.message === "PATIENT_NOT_FOUND") return error("Patient not found", 404);
      if (err.message === "ASSIGNEE_NOT_IN_ORG") {
        return error("Assignee must belong to this organization", 400);
      }
      if (err.message === "VISIT_NOT_FOUND") return error("Visit not found", 404);
    }
    return serverError(err);
  }
});
