import { prisma } from "@/lib/prisma";

const OPEN_ESCALATION = ["open", "in_review"] as const;
const OPEN_INCIDENT = ["reported", "triaged"] as const;

export type OrgComplianceCounts = {
  openComplianceItems: number;
  openClinicalAlerts: number;
  openCriticalAlerts: number;
  openEscalations: number;
  openIncidents: number;
  pendingVisitReviews: number;
  missedVisitsToday: number;
};

export async function getOrgComplianceCounts(
  orgId: string,
  opts?: { branchId?: string; orgHasBranches?: boolean },
): Promise<OrgComplianceCounts> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const { branchId, orgHasBranches } = opts ?? {};
  const patientBranch = branchId
    ? { patient: { branchId } }
    : orgHasBranches
      ? { patient: { branchId: { not: null } } }
      : {};
  const visitLogPatientBranch = branchId
    ? { visitLog: { patient: { branchId } } }
    : orgHasBranches
      ? { visitLog: { patient: { branchId: { not: null } } } }
      : {};

  const [
    alertsBySeverity,
    openEscalations,
    openIncidents,
    pendingVisitReviews,
    missedVisitsToday,
  ] = await Promise.all([
    prisma.clinicalAlert.groupBy({
      by: ["severity"],
      where: { orgId, isResolved: false, ...patientBranch },
      _count: { _all: true },
    }),
    prisma.escalation.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: [...OPEN_ESCALATION] },
        ...patientBranch,
      },
    }),
    prisma.incident.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: [...OPEN_INCIDENT] },
        ...patientBranch,
      },
    }),
    prisma.visitReview.count({
      where: { orgId, status: "pending", ...visitLogPatientBranch },
    }),
    prisma.visitLog.count({
      where: {
        orgId,
        deletedAt: null,
        scheduledAt: { gte: startOfToday, lte: endOfToday },
        status: "missed",
        ...patientBranch,
      },
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

  return {
    openComplianceItems:
      openClinicalAlerts +
      openEscalations +
      openIncidents +
      pendingVisitReviews +
      missedVisitsToday,
    openClinicalAlerts,
    openCriticalAlerts: alertSeverityCounts.critical,
    openEscalations,
    openIncidents,
    pendingVisitReviews,
    missedVisitsToday,
  };
}
