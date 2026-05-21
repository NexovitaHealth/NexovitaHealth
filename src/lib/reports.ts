import { prisma } from "@/lib/prisma";

export type ReportType = "census" | "visits" | "vitals" | "billing" | "outcomes";

export type ReportResult = {
  summary: Record<string, unknown>;
  chartData: Array<{ label: string; value: number }>;
  exportRows: Array<Record<string, string | number | null>>;
};

export function getDateRange(range: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    case "12m":
      start.setMonth(start.getMonth() - 12);
      break;
    case "ytd":
      start.setMonth(0);
      start.setDate(1);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }
  return { start, end };
}

export function parseReportType(type: string): ReportType | null {
  if (["census", "visits", "vitals", "billing", "outcomes"].includes(type)) {
    return type as ReportType;
  }
  return null;
}

export function getReportExportColumns(reportType: Exclude<ReportType, "billing">) {
  const columns = {
    census: [
      "patientId",
      "fullName",
      "status",
      "riskLevel",
      "primaryDiagnosis",
      "admissionDate",
      "dischargeDate",
    ],
    visits: [
      "visitId",
      "patientId",
      "patientName",
      "staffId",
      "staffName",
      "visitType",
      "status",
      "scheduledAt",
      "checkinAt",
      "checkoutAt",
      "durationMinutes",
    ],
    vitals: [
      "vitalId",
      "patientId",
      "patientName",
      "recordedById",
      "recordedByName",
      "recordedAt",
      "systolicBp",
      "diastolicBp",
      "heartRate",
      "respiratoryRate",
      "temperature",
      "oxygenSaturation",
      "painScore",
    ],
    outcomes: [
      "patientId",
      "fullName",
      "status",
      "riskLevel",
      "admissionDate",
      "dischargeDate",
    ],
  } satisfies Record<Exclude<ReportType, "billing">, string[]>;
  return columns[reportType];
}

export async function getOrgReport(
  orgId: string,
  reportType: ReportType,
  range: string,
): Promise<ReportResult> {
  const { start, end } = getDateRange(range);

  const patients = await prisma.patient.findMany({
    where: { orgId, status: "active", deletedAt: null },
    select: {
      id: true,
      fullName: true,
      riskLevel: true,
      status: true,
      admissionDate: true,
      dischargeDate: true,
      primaryDiagnosis: true,
    },
  });
  const patientIds = patients.map((p) => p.id);

  if (reportType === "census") {
    const active = patients.filter((p) => p.status === "active").length;
    const highRisk = patients.filter(
      (p) => p.riskLevel === "high" || p.riskLevel === "critical",
    ).length;
    const newAdmissions = patients.filter(
      (p) => p.admissionDate && p.admissionDate >= start && p.admissionDate <= end,
    ).length;

    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString("en-US", { month: "short" });
      const value = patients.filter((p) => {
        if (!p.admissionDate) return false;
        const adm = new Date(p.admissionDate);
        return (
          adm.getMonth() === d.getMonth() &&
          adm.getFullYear() === d.getFullYear()
        );
      }).length;
      chartData.push({ label, value });
    }

    return {
      summary: {
        activePatients: active,
        highRisk,
        newAdmissions,
        discharges: patients.filter(
          (p) =>
            p.dischargeDate && p.dischargeDate >= start && p.dischargeDate <= end,
        ).length,
      },
      chartData,
      exportRows: patients.map((patient) => ({
        patientId: patient.id,
        fullName: patient.fullName,
        status: patient.status,
        riskLevel: patient.riskLevel,
        primaryDiagnosis: patient.primaryDiagnosis,
        admissionDate: patient.admissionDate?.toISOString() ?? null,
        dischargeDate: patient.dischargeDate?.toISOString() ?? null,
      })),
    };
  }

  if (reportType === "visits") {
    const visits = await prisma.visitLog.findMany({
      where: {
        patientId: { in: patientIds },
        scheduledAt: { gte: start, lte: end },
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        loggedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
    const completed = visits.filter((v) => v.status === "completed").length;
    const missed = visits.filter((v) => v.status === "missed").length;
    const weeks = new Map<string, number>();
    visits.forEach((visit) => {
      const d = new Date(visit.scheduledAt);
      const wk = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString("en-US", {
        month: "short",
      })}`;
      weeks.set(wk, (weeks.get(wk) || 0) + 1);
    });

    return {
      summary: {
        totalVisits: visits.length,
        completed,
        missed,
        completionRate: visits.length ? Math.round((completed / visits.length) * 100) : 0,
        avgDuration:
          visits.length > 0
            ? Math.round(
                visits.reduce((sum, visit) => sum + (visit.durationMinutes || 0), 0) /
                  visits.length,
              )
            : 0,
      },
      chartData: Array.from(weeks.entries()).map(([label, value]) => ({
        label,
        value,
      })),
      exportRows: visits.map((visit) => ({
        visitId: visit.id,
        patientId: visit.patientId,
        patientName: visit.patient.fullName,
        staffId: visit.loggedById,
        staffName: visit.loggedBy.fullName,
        visitType: visit.visitType,
        status: visit.status,
        scheduledAt: visit.scheduledAt.toISOString(),
        checkinAt: visit.checkinAt?.toISOString() ?? null,
        checkoutAt: visit.checkoutAt?.toISOString() ?? null,
        durationMinutes: visit.durationMinutes,
      })),
    };
  }

  if (reportType === "vitals") {
    const vitals = await prisma.patientVital.findMany({
      where: {
        patientId: { in: patientIds },
        recordedAt: { gte: start, lte: end },
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        recordedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { recordedAt: "desc" },
    });
    const alerts = await prisma.clinicalAlert.findMany({
      where: {
        patientId: { in: patientIds },
        createdAt: { gte: start, lte: end },
      },
      select: { severity: true },
    });
    const avgHr =
      vitals
        .filter((v) => v.heartRate)
        .reduce((acc, v) => acc + (v.heartRate || 0), 0) /
      (vitals.filter((v) => v.heartRate).length || 1);
    const avgSpo2 =
      vitals
        .filter((v) => v.oxygenSaturation)
        .reduce((acc, v) => acc + (v.oxygenSaturation || 0), 0) /
      (vitals.filter((v) => v.oxygenSaturation).length || 1);
    const days = new Map<string, number>();
    vitals.forEach((vital) => {
      const day = vital.recordedAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      days.set(day, (days.get(day) || 0) + 1);
    });

    return {
      summary: {
        totalReadings: vitals.length,
        criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
        avgHeartRate: Math.round(avgHr),
        avgSpO2: Math.round(avgSpo2),
      },
      chartData: Array.from(days.entries())
        .slice(-14)
        .map(([label, value]) => ({ label, value })),
      exportRows: vitals.map((vital) => ({
        vitalId: vital.id,
        patientId: vital.patientId,
        patientName: vital.patient.fullName,
        recordedById: vital.recordedById,
        recordedByName: vital.recordedBy.fullName,
        recordedAt: vital.recordedAt.toISOString(),
        systolicBp: vital.systolicBp,
        diastolicBp: vital.diastolicBp,
        heartRate: vital.heartRate,
        respiratoryRate: vital.respiratoryRate,
        temperature: vital.temperature,
        oxygenSaturation: vital.oxygenSaturation,
        painScore: vital.painScore,
      })),
    };
  }

  if (reportType === "outcomes") {
    return {
      summary: { total: patients.length, period: range },
      chartData: [],
      exportRows: patients.map((patient) => ({
        patientId: patient.id,
        fullName: patient.fullName,
        status: patient.status,
        riskLevel: patient.riskLevel,
        admissionDate: patient.admissionDate?.toISOString() ?? null,
        dischargeDate: patient.dischargeDate?.toISOString() ?? null,
      })),
    };
  }

  return {
    summary: { total: 0, period: range },
    chartData: [],
    exportRows: [],
  };
}

export function toCsv(
  rows: Array<Record<string, string | number | null>>,
  columns?: string[],
) {
  const headers = columns ?? Object.keys(rows[0] ?? {});
  if (headers.length === 0) return "";
  const escapeCell = (value: string | number | null) => {
    if (value === null || value === undefined) return "";
    const raw = String(value);
    return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n");
}
