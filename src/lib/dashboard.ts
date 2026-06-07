import { prisma } from "@/lib/prisma";
import { getOrgComplianceCounts } from "@/lib/compliance-counts";

export async function getOrgDashboardSummary(
  orgId: string,
  branchId?: string,
  orgHasBranches?: boolean,
) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const branchClause = branchId
    ? { branchId }
    : orgHasBranches
      ? { branchId: { not: null } }
      : {};
  const patientBranchClause = branchId
    ? { patient: { branchId } }
    : orgHasBranches
      ? { patient: { branchId: { not: null } } }
      : {};

  const patientBase = {
    orgId,
    deletedAt: null,
    isDraft: false,
    status: "active" as const,
    ...branchClause,
  };

  const visitBase = {
    orgId,
    deletedAt: null,
    ...patientBranchClause,
  };

  const [
    totalPatients,
    highRiskPatients,
    openTasks,
    unresolvedAlerts,
    visitsToday,
    pendingVisitReviews,
    missedVisitsToday,
    compliance,
  ] = await Promise.all([
    prisma.patient.count({ where: patientBase }),
    prisma.patient.count({
      where: { ...patientBase, riskLevel: { in: ["high", "critical"] } },
    }),
    prisma.task.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: ["pending", "in_progress"] },
        // Specific branch: only tasks tied to patients in that branch.
        // All Locations (org has branches): patient-linked tasks for any branch + org-wide tasks.
        // No branches: all tasks.
        ...(branchId
          ? { patient: { branchId } }
          : orgHasBranches
            ? { OR: [{ patient: { branchId: { not: null } } }, { patientId: null }] }
            : {}),
      },
    }),
    prisma.clinicalAlert.count({
      where: {
        orgId,
        isResolved: false,
        ...patientBranchClause,
      },
    }),
    prisma.visitLog.count({
      where: {
        ...visitBase,
        scheduledAt: { gte: startOfToday, lte: endOfToday },
        status: { not: "cancelled" },
      },
    }),
    prisma.visitReview.count({
      where: {
        orgId,
        status: "pending",
        ...(branchId
          ? { visitLog: { patient: { branchId } } }
          : orgHasBranches
            ? { visitLog: { patient: { branchId: { not: null } } } }
            : {}),
      },
    }),
    prisma.visitLog.count({
      where: {
        ...visitBase,
        scheduledAt: { gte: startOfToday, lte: endOfToday },
        status: "missed",
      },
    }),
    getOrgComplianceCounts(orgId, { branchId, orgHasBranches }),
  ]);

  return {
    totalPatients,
    highRiskPatients,
    openTasks,
    unresolvedAlerts,
    visitsToday,
    pendingVisitReviews,
    missedVisitsToday,
    compliance,
  };
}
