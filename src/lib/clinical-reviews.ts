import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { getOrgPatientOrThrow } from "@/lib/care-plans";

export const escalationInclude = {
  patient: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true, role: true } },
  assignedTo: { select: { id: true, fullName: true, role: true } },
  sourceVital: {
    select: {
      id: true,
      recordedAt: true,
      systolicBp: true,
      diastolicBp: true,
      heartRate: true,
    },
  },
  sourceVisit: {
    select: { id: true, visitType: true, scheduledAt: true, status: true },
  },
  incident: { select: { id: true, incidentType: true, status: true } },
  physicianOrders: {
    where: { deletedAt: null },
    select: { id: true, title: true, status: true },
    take: 5,
  },
} satisfies Prisma.EscalationInclude;

export const incidentInclude = {
  patient: { select: { id: true, fullName: true } },
  reportedBy: { select: { id: true, fullName: true, role: true } },
  assignedTo: { select: { id: true, fullName: true, role: true } },
  visitLog: {
    select: { id: true, visitType: true, scheduledAt: true, status: true },
  },
  escalations: {
    where: { deletedAt: null },
    select: { id: true, title: true, status: true, severity: true },
  },
} satisfies Prisma.IncidentInclude;

export function assertClinicalReviewer(role: string) {
  if (!["agency_admin", "supervisor", "physician", "physician_independent"].includes(role)) {
    throw new Error("REVIEW_FORBIDDEN");
  }
}

export function assertIncidentReporter(role: string) {
  const allowed = [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "school_nurse",
  ];
  if (!allowed.includes(role)) {
    throw new Error("INCIDENT_FORBIDDEN");
  }
}

export async function ensureOrgAssignee(
  orgId: string,
  userId: string | undefined,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  if (!userId) return null;
  const membership = await client.orgMembership.findFirst({
    where: { orgId, userId, user: { isActive: true, deletedAt: null } },
    include: { user: { select: { id: true, fullName: true, role: true } } },
  });
  if (!membership) throw new Error("ASSIGNEE_NOT_IN_ORG");
  return membership.user;
}

export async function getOrgEscalationOrThrow(
  orgId: string,
  escalationId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const escalation = await client.escalation.findFirst({
    where: { id: escalationId, orgId, deletedAt: null },
    include: escalationInclude,
  });
  if (!escalation) throw new Error("ESCALATION_NOT_FOUND");
  return escalation;
}

export async function getOrgIncidentOrThrow(
  orgId: string,
  incidentId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const incident = await client.incident.findFirst({
    where: { id: incidentId, orgId, deletedAt: null },
    include: incidentInclude,
  });
  if (!incident) throw new Error("INCIDENT_NOT_FOUND");
  return incident;
}

export async function ensureVisitInOrg(
  orgId: string,
  visitLogId: string | undefined,
  patientId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  if (!visitLogId) return null;
  const visit = await client.visitLog.findFirst({
    where: { id: visitLogId, orgId, patientId, deletedAt: null },
    select: { id: true },
  });
  if (!visit) throw new Error("VISIT_NOT_FOUND");
  return visit;
}

export async function ensureVitalInOrg(
  orgId: string,
  vitalId: string | undefined,
  patientId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  if (!vitalId) return null;
  const vital = await client.patientVital.findFirst({
    where: { id: vitalId, patient: { id: patientId, orgId } },
    select: { id: true },
  });
  if (!vital) throw new Error("VITAL_NOT_FOUND");
  return vital;
}

export async function notifyClinicalEscalation(params: {
  orgId: string;
  patientId: string;
  patientName: string;
  escalationId: string;
  title: string;
  severity: string;
  actorName: string;
}) {
  const recipients = await prisma.orgMembership.findMany({
    where: {
      orgId: params.orgId,
      user: {
        isActive: true,
        deletedAt: null,
        role: { in: ["agency_admin", "supervisor", "physician", "physician_independent"] },
      },
    },
    select: { userId: true },
  });

  const actionUrl = `/escalations`;

  await createNotifications(
    recipients.map((r) => ({
      userId: r.userId,
      type: "escalation",
      title: `Clinical escalation: ${params.patientName}`,
      body: `${params.actorName} — ${params.title} (${params.severity})`,
      actionUrl,
      metadata: {
        orgId: params.orgId,
        patientId: params.patientId,
        escalationId: params.escalationId,
        severity: params.severity,
      },
    })),
  );
}

export async function notifyIncidentReported(params: {
  orgId: string;
  patientId: string;
  patientName: string;
  incidentId: string;
  incidentType: string;
  severity: string;
  reporterName: string;
}) {
  const recipients = await prisma.orgMembership.findMany({
    where: {
      orgId: params.orgId,
      user: {
        isActive: true,
        deletedAt: null,
        role: { in: ["agency_admin", "supervisor", "physician", "physician_independent"] },
      },
    },
    select: { userId: true },
  });

  await createNotifications(
    recipients.map((r) => ({
      userId: r.userId,
      type: "incident",
      title: `Incident reported: ${params.patientName}`,
      body: `${params.reporterName} — ${params.incidentType} (${params.severity})`,
      actionUrl: `/incidents`,
      metadata: {
        orgId: params.orgId,
        patientId: params.patientId,
        incidentId: params.incidentId,
        severity: params.severity,
      },
    })),
  );
}

export { getOrgPatientOrThrow };
