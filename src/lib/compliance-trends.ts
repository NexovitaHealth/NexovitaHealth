import { prisma } from "@/lib/prisma";

export const COMPLIANCE_TREND_DAY_OPTIONS = [7, 14, 30] as const;
export type ComplianceTrendDays = (typeof COMPLIANCE_TREND_DAY_OPTIONS)[number];

export type TrendPoint = { date: string; count: number };

export type ComplianceTrendSeries = {
  days: ComplianceTrendDays;
  from: string;
  to: string;
  alerts: TrendPoint[];
  escalations: TrendPoint[];
  incidents: TrendPoint[];
  visitReviews: TrendPoint[];
  missedVisits: TrendPoint[];
};

export function clampComplianceTrendDays(value: unknown): ComplianceTrendDays {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (n <= 7) return 7;
  if (n >= 30) return 30;
  if (n <= 14) return 14;
  return 14;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date) {
  return startOfDay(d).toISOString().slice(0, 10);
}

function buildDayKeys(days: number): string[] {
  const today = startOfDay(new Date());
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

function bucketByDay(
  dayKeys: string[],
  rows: Array<{ at: Date }>,
): TrendPoint[] {
  const counts = new Map(dayKeys.map((k) => [k, 0]));
  for (const row of rows) {
    const key = dayKey(row.at);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return dayKeys.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export async function getOrgComplianceTrends(
  orgId: string,
  days: ComplianceTrendDays,
): Promise<ComplianceTrendSeries> {
  const dayKeys = buildDayKeys(days);
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - (days - 1));
  const to = new Date();

  const [alerts, escalations, incidents, visitReviews, missedVisits] =
    await Promise.all([
      prisma.clinicalAlert.findMany({
        where: { orgId, createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
      prisma.escalation.findMany({
        where: { orgId, deletedAt: null, createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
      prisma.incident.findMany({
        where: { orgId, deletedAt: null, occurredAt: { gte: from, lte: to } },
        select: { occurredAt: true },
      }),
      prisma.visitReview.findMany({
        where: { orgId, createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
      prisma.visitLog.findMany({
        where: {
          orgId,
          deletedAt: null,
          status: "missed",
          scheduledAt: { gte: from, lte: to },
        },
        select: { scheduledAt: true },
      }),
    ]);

  return {
    days,
    from: dayKeys[0]!,
    to: dayKeys[dayKeys.length - 1]!,
    alerts: bucketByDay(
      dayKeys,
      alerts.map((r) => ({ at: r.createdAt })),
    ),
    escalations: bucketByDay(
      dayKeys,
      escalations.map((r) => ({ at: r.createdAt })),
    ),
    incidents: bucketByDay(
      dayKeys,
      incidents.map((r) => ({ at: r.occurredAt })),
    ),
    visitReviews: bucketByDay(
      dayKeys,
      visitReviews.map((r) => ({ at: r.createdAt })),
    ),
    missedVisits: bucketByDay(
      dayKeys,
      missedVisits.map((r) => ({ at: r.scheduledAt })),
    ),
  };
}
