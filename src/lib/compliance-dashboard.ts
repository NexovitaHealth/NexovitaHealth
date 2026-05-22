import { prisma } from "@/lib/prisma";
import { syncExpiredAuthorisations } from "@/lib/payer-authorisations";

const OPEN_ESCALATION = ["open", "in_review"] as const;
const OPEN_INCIDENT = ["reported", "triaged"] as const;

export async function getOrgComplianceDashboard(orgId: string) {
  await syncExpiredAuthorisations(orgId);

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [
    alertsBySeverity,
    openEscalations,
    openIncidents,
    pendingVisitReviews,
    missedVisitsToday,
    expiringAuthorisations,
    highRiskActivePatients,
    recentClinicalAlerts,
    recentEscalations,
    recentIncidents,
  ] = await Promise.all([
    prisma.clinicalAlert.groupBy({
      by: ["severity"],
      where: { orgId, isResolved: false },
      _count: { _all: true },
    }),
    prisma.escalation.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: [...OPEN_ESCALATION] },
      },
    }),
    prisma.incident.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: [...OPEN_INCIDENT] },
      },
    }),
    prisma.visitReview.count({
      where: { orgId, status: "pending" },
    }),
    prisma.visitLog.count({
      where: {
        orgId,
        deletedAt: null,
        scheduledAt: { gte: startOfToday, lte: endOfToday },
        status: "missed",
      },
    }),
    prisma.payerAuthorisation.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: "active",
        endDate: { lte: in30Days, gte: now },
      },
      orderBy: { endDate: "asc" },
      take: 8,
      include: { patient: { select: { id: true, fullName: true } } },
    }),
    prisma.patient.count({
      where: {
        orgId,
        deletedAt: null,
        isDraft: false,
        status: "active",
        riskLevel: { in: ["high", "critical"] },
      },
    }),
    prisma.clinicalAlert.findMany({
      where: { orgId, isResolved: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { patient: { select: { id: true, fullName: true } } },
    }),
    prisma.escalation.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { in: [...OPEN_ESCALATION] },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: { patient: { select: { id: true, fullName: true } } },
    }),
    prisma.incident.findMany({
      where: {
        orgId,
        deletedAt: null,
        status: { in: [...OPEN_INCIDENT] },
      },
      orderBy: [{ severity: "desc" }, { occurredAt: "desc" }],
      take: 6,
      include: { patient: { select: { id: true, fullName: true } } },
    }),
  ]);

  const alertSeverityCounts = {
    critical: 0,
    warning: 0,
    info: 0,
  };
  for (const row of alertsBySeverity) {
    const key = row.severity as keyof typeof alertSeverityCounts;
    if (key in alertSeverityCounts) {
      alertSeverityCounts[key] = row._count._all;
    }
  }

  const openClinicalAlerts =
    alertSeverityCounts.critical +
    alertSeverityCounts.warning +
    alertSeverityCounts.info;

  const openComplianceItems =
    openClinicalAlerts +
    openEscalations +
    openIncidents +
    pendingVisitReviews +
    missedVisitsToday;

  return {
    counts: {
      openComplianceItems,
      openClinicalAlerts,
      openCriticalAlerts: alertSeverityCounts.critical,
      openWarningAlerts: alertSeverityCounts.warning,
      openEscalations,
      openIncidents,
      pendingVisitReviews,
      missedVisitsToday,
      expiringAuthorisations: expiringAuthorisations.length,
      highRiskActivePatients,
    },
    alertSeverityCounts,
    expiringAuthorisations,
    recentClinicalAlerts,
    recentEscalations,
    recentIncidents,
  };
}
