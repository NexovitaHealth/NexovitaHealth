import { prisma } from "@/lib/prisma";

export async function getOrgDashboardSummary(orgId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const patientBase = {
    orgId,
    deletedAt: null,
    isDraft: false,
    status: "active" as const,
  };

  const [
    totalPatients,
    highRiskPatients,
    openTasks,
    unresolvedAlerts,
    visitsToday,
    pendingVisitReviews,
    missedVisitsToday,
  ] = await Promise.all([
    prisma.patient.count({ where: patientBase }),
    prisma.patient.count({
      where: {
        ...patientBase,
        riskLevel: { in: ["high", "critical"] },
      },
    }),
    prisma.task.count({
      where: {
        orgId,
        deletedAt: null,
        status: { in: ["pending", "in_progress"] },
      },
    }),
    prisma.clinicalAlert.count({
      where: { orgId, isResolved: false },
    }),
    prisma.visitLog.count({
      where: {
        orgId,
        deletedAt: null,
        scheduledAt: { gte: startOfToday, lte: endOfToday },
        status: { not: "cancelled" },
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
  ]);

  return {
    totalPatients,
    highRiskPatients,
    openTasks,
    unresolvedAlerts,
    visitsToday,
    pendingVisitReviews,
    missedVisitsToday,
  };
}
