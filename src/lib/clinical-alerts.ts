import type { AlertSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const clinicalAlertInclude = {
  patient: { select: { id: true, fullName: true, riskLevel: true } },
  vital: {
    select: {
      id: true,
      recordedAt: true,
      systolicBp: true,
      diastolicBp: true,
      heartRate: true,
      oxygenSaturation: true,
    },
  },
} satisfies Prisma.ClinicalAlertInclude;

export async function getOrgClinicalAlertOrThrow(orgId: string, alertId: string) {
  const alert = await prisma.clinicalAlert.findFirst({
    where: { id: alertId, orgId },
    include: clinicalAlertInclude,
  });
  if (!alert) throw new Error("ALERT_NOT_FOUND");
  return alert;
}

export async function listOrgClinicalAlerts(
  orgId: string,
  params: {
    page: number;
    pageSize: number;
    resolved?: "true" | "false" | "all";
    severity?: AlertSeverity;
    patientId?: string;
    alertType?: string;
  },
) {
  const where: Prisma.ClinicalAlertWhereInput = {
    orgId,
    ...(params.patientId && { patientId: params.patientId }),
    ...(params.severity && { severity: params.severity }),
    ...(params.alertType && {
      alertType: { contains: params.alertType, mode: "insensitive" },
    }),
    ...(params.resolved === "true"
      ? { isResolved: true }
      : params.resolved === "all"
        ? {}
        : { isResolved: false }),
  };

  const skip = (params.page - 1) * params.pageSize;
  const take = params.pageSize;

  const [items, total, openCritical] = await Promise.all([
    prisma.clinicalAlert.findMany({
      where,
      skip,
      take,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      include: clinicalAlertInclude,
    }),
    prisma.clinicalAlert.count({ where }),
    prisma.clinicalAlert.count({
      where: { orgId, isResolved: false, severity: "critical" },
    }),
  ]);

  return { items, total, openCritical };
}

export async function resolveClinicalAlert(
  orgId: string,
  alertId: string,
  resolvedById: string,
) {
  const alert = await getOrgClinicalAlertOrThrow(orgId, alertId);
  if (alert.isResolved) throw new Error("ALERT_ALREADY_RESOLVED");

  return prisma.clinicalAlert.update({
    where: { id: alert.id },
    data: {
      isResolved: true,
      resolvedBy: resolvedById,
      resolvedAt: new Date(),
    },
    include: clinicalAlertInclude,
  });
}
