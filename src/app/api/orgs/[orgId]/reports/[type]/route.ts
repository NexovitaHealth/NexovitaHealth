import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { success, serverError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function getDateRange(range: string): { start: Date; end: Date } {
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

export const GET = withAuth(async (req: NextRequest, ctx, auth) => {
  try {
    const { orgId } = auth;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

    const reportType = ctx.params.type;
    const range = req.nextUrl.searchParams.get("range") || "30d";
    const { start, end } = getDateRange(range);

    const patients: Array<{
      id: string;
      riskLevel: string;
      status: string;
      admissionDate: Date | null;
    }> = await prisma.patient.findMany({
      where: { orgId, status: "active", deletedAt: null },
      select: { id: true, riskLevel: true, status: true, admissionDate: true },
    });
    const patientIds = patients.map((p: { id: string }) => p.id);

    let summary: Record<string, unknown> = {};
    let chartData: Array<{ label: string; value: number }> = [];

    if (reportType === "census") {
      const active = patients.filter(
        (p: {
          id: string;
          riskLevel: string;
          status: string;
          admissionDate: Date | null;
        }) => p.status === "active",
      ).length;
      const highRisk = patients.filter(
        (p) => p.riskLevel === "high" || p.riskLevel === "critical",
      ).length;
      const newAdmissions = patients.filter(
        (p) =>
          p.admissionDate && p.admissionDate >= start && p.admissionDate <= end,
      ).length;
      summary = {
        activePatients: active,
        highRisk,
        newAdmissions,
        discharges: 0,
      };

      // Monthly breakdown for last 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const label = d.toLocaleString("en-US", { month: "short" });
        const count = patients.filter((p) => {
          if (!p.admissionDate) return false;
          const adm = new Date(p.admissionDate);
          return (
            adm.getMonth() === d.getMonth() &&
            adm.getFullYear() === d.getFullYear()
          );
        }).length;
        chartData.push({ label, value: count });
      }
    }

    if (reportType === "visits") {
      const visits: Array<{ status: string; scheduledAt: Date }> =
        await prisma.visitLog.findMany({
          where: {
            patientId: { in: patientIds },
            scheduledAt: { gte: start, lte: end },
          },
          select: { status: true, scheduledAt: true },
        });
      const completed = visits.filter(
        (v: { status: string; scheduledAt: Date }) => v.status === "completed",
      ).length;
      const missed = visits.filter((v) => v.status === "missed").length;
      summary = {
        totalVisits: visits.length,
        completed,
        missed,
        completionRate: visits.length
          ? Math.round((completed / visits.length) * 100)
          : 0,
      };
      // Group by week
      const weeks = new Map<string, number>();
      visits.forEach((v: { status: string; scheduledAt: Date }) => {
        if (!v.scheduledAt) return;
        const d = new Date(v.scheduledAt);
        const wk = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString("en-US", { month: "short" })}`;
        weeks.set(wk, (weeks.get(wk) || 0) + 1);
      });
      chartData = Array.from(weeks.entries()).map(([label, value]) => ({
        label,
        value,
      }));
    }

    if (reportType === "vitals") {
      const vitals: Array<{
        heartRate: number | null;
        oxygenSaturation: number | null;
        recordedAt: Date;
      }> = await prisma.patientVital.findMany({
        where: {
          patientId: { in: patientIds },
          recordedAt: { gte: start, lte: end },
        },
        select: { heartRate: true, oxygenSaturation: true, recordedAt: true },
      });
      const alerts: Array<{ severity: string }> =
        await prisma.clinicalAlert.findMany({
          where: {
            patientId: { in: patientIds },
            createdAt: { gte: start, lte: end },
          },
          select: { severity: true },
        });
      const critical = alerts.filter(
        (a: { severity: string }) => a.severity === "critical",
      ).length;
      const avgHr =
        vitals
          .filter(
            (v: {
              heartRate: number | null;
              oxygenSaturation: number | null;
              recordedAt: Date;
            }) => v.heartRate,
          )
          .reduce(
            (
              acc: number,
              v: {
                heartRate: number | null;
                oxygenSaturation: number | null;
                recordedAt: Date;
              },
            ) => acc + (v.heartRate || 0),
            0,
          ) / (vitals.filter((v) => v.heartRate).length || 1);
      const avgSpo2 =
        vitals
          .filter((v) => v.oxygenSaturation)
          .reduce((acc, v) => acc + (v.oxygenSaturation || 0), 0) /
        (vitals.filter((v) => v.oxygenSaturation).length || 1);
      summary = {
        totalReadings: vitals.length,
        criticalAlerts: critical,
        avgHeartRate: Math.round(avgHr),
        avgSpO2: Math.round(avgSpo2),
      };
      // Daily counts
      const days = new Map<string, number>();
      vitals.forEach((v: { recordedAt: Date }) => {
        const d = v.recordedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        days.set(d, (days.get(d) || 0) + 1);
      });
      chartData = Array.from(days.entries())
        .slice(-14)
        .map(([label, value]) => ({ label, value }));
    }

    if (reportType === "billing") {
      summary = { total: 0, period: range };
      chartData = [];
    }

    if (reportType === "outcomes") {
      summary = { total: patients.length, period: range };
    }

    return success({ summary, chartData });
  } catch (err) {
    console.error(err);
    return serverError(err);
  }
});
