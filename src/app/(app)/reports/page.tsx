"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import {
  BarChart3,
  ChevronDown,
  Download,
  Calendar,
  Users,
  Activity,
  FileText,
  TrendingUp,
  Clock,
  Loader2,
} from "lucide-react";

type ReportType = "census" | "visits" | "vitals" | "billing" | "outcomes";

const REPORTS: Array<{
  id: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}> = [
  {
    id: "census",
    title: "Patient Census",
    description: "Admission, discharge, and active patient counts by period",
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: "visits",
    title: "Visit Summary",
    description: "Completed visits, missed visits, and visit types breakdown",
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    id: "vitals",
    title: "Vital Signs Trends",
    description: "Aggregate vital sign trends and alert frequency analysis",
    icon: <Activity className="w-5 h-5" />,
  },
  {
    id: "outcomes",
    title: "Patient Outcomes",
    description:
      "Discharge dispositions, readmission rates, care plan progress",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    id: "billing",
    title: "Billing Summary",
    description: "Claims, revenue, and payer breakdown for the selected period",
    icon: <FileText className="w-5 h-5" />,
    adminOnly: true,
  },
];

const DATE_RANGES = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "Last 12 months", value: "12m" },
  { label: "Year to date", value: "ytd" },
];

function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-teal-50 rounded-xl text-[#028090]">{icon}</div>
        {trend !== undefined && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-md ${trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
          >
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const { request, orgId } = useApi();
  const [selectedReport, setSelectedReport] = useState<ReportType>("census");
  const [dateRange, setDateRange] = useState("30d");
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["report", orgId, selectedReport, dateRange],
    queryFn: () =>
      request(`/api/orgs/{orgId}/reports/${selectedReport}?range=${dateRange}`),
    enabled: !!orgId,
  });

  const reportData = data?.data as
    | {
        summary?: Record<string, unknown>;
        chartData?: Array<{ label: string; value: number }>;
      }
    | undefined;
  const stats = reportData?.summary || {};
  const chartData = reportData?.chartData || [];

  const handleExport = async (format: "csv" | "pdf") => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/reports/${selectedReport}/export?range=${dateRange}&format=${format}`,
        {
          headers: { Accept: format === "pdf" ? "application/pdf" : "text/csv" },
        },
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nexovita-${selectedReport}-${dateRange}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const report = REPORTS.find((r) => r.id === selectedReport);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#028090]" /> Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Analytics and compliance reporting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen((open) => !open)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {/* Sidebar */}
        <div className="col-span-1 space-y-2">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                selectedReport === r.id
                  ? "bg-[#028090] text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 bg-white border border-slate-200"
              }`}
            >
              <div
                className={
                  selectedReport === r.id ? "text-white/80" : "text-slate-400"
                }
              >
                {r.icon}
              </div>
              <div>
                <p className="font-semibold leading-none">{r.title}</p>
                <p
                  className={`text-xs mt-0.5 ${selectedReport === r.id ? "text-white/60" : "text-slate-400"}`}
                >
                  {r.adminOnly ? "Admin only" : "All roles"}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Report content */}
        <div className="col-span-3">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              {report?.title}
            </h2>
            <p className="text-sm text-slate-500">{report?.description}</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-7 h-7 text-slate-300 animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {selectedReport === "census" && (
                  <>
                    <StatCard
                      label="Active Patients"
                      value={String(stats.activePatients ?? 0)}
                      icon={<Users className="w-4 h-4" />}
                      trend={stats.activeTrend as number | undefined}
                    />
                    <StatCard
                      label="New Admissions"
                      value={String(stats.newAdmissions ?? 0)}
                      icon={<TrendingUp className="w-4 h-4" />}
                      sub="in selected period"
                    />
                    <StatCard
                      label="Discharges"
                      value={String(stats.discharges ?? 0)}
                      icon={<FileText className="w-4 h-4" />}
                    />
                    <StatCard
                      label="High Risk Patients"
                      value={String(stats.highRisk ?? 0)}
                      icon={<Activity className="w-4 h-4" />}
                    />
                  </>
                )}
                {selectedReport === "visits" && (
                  <>
                    <StatCard
                      label="Total Visits"
                      value={String(stats.totalVisits ?? 0)}
                      icon={<Calendar className="w-4 h-4" />}
                      trend={stats.visitTrend as number | undefined}
                    />
                    <StatCard
                      label="Completed"
                      value={String(stats.completed ?? 0)}
                      icon={<Clock className="w-4 h-4" />}
                      sub={`${stats.completionRate ?? 0}% completion rate`}
                    />
                    <StatCard
                      label="Missed"
                      value={String(stats.missed ?? 0)}
                      icon={<Clock className="w-4 h-4" />}
                    />
                    <StatCard
                      label="Avg. Duration"
                      value={String(stats.avgDuration ?? "—")}
                      sub="minutes avg"
                      icon={<Clock className="w-4 h-4" />}
                    />
                  </>
                )}
                {selectedReport === "vitals" && (
                  <>
                    <StatCard
                      label="Readings Recorded"
                      value={String(stats.totalReadings ?? 0)}
                      icon={<Activity className="w-4 h-4" />}
                    />
                    <StatCard
                      label="Critical Alerts"
                      value={String(stats.criticalAlerts ?? 0)}
                      icon={<Activity className="w-4 h-4" />}
                    />
                    <StatCard
                      label="Avg. SpO₂"
                      value={String(stats.avgSpO2 ?? "—")}
                      sub="percent"
                      icon={<Activity className="w-4 h-4" />}
                    />
                    <StatCard
                      label="Avg. Heart Rate"
                      value={String(stats.avgHeartRate ?? "—")}
                      sub="bpm avg"
                      icon={<Activity className="w-4 h-4" />}
                    />
                  </>
                )}
                {(selectedReport === "billing" ||
                  selectedReport === "outcomes") && (
                  <>
                    <StatCard
                      label="Total Records"
                      value={String(stats.total ?? 0)}
                      icon={<FileText className="w-4 h-4" />}
                    />
                    <StatCard
                      label="Period"
                      value={
                        DATE_RANGES.find((r) => r.value === dateRange)?.label ||
                        dateRange
                      }
                      icon={<Calendar className="w-4 h-4" />}
                    />
                  </>
                )}
              </div>

              {/* Empty state / chart placeholder */}
              {chartData.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
                  <BarChart3 className="w-12 h-12 mb-3 text-slate-200" />
                  <p className="font-medium text-slate-500">
                    No data for this period
                  </p>
                  <p className="text-sm mt-1">Try adjusting the date range</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">
                    Trend Chart
                  </h3>
                  {/* Simple bar chart using divs */}
                  <div className="flex items-end gap-2 h-40">
                    {chartData.map(
                      (point: { label: string; value: number }, i: number) => {
                        const max = Math.max(
                          ...chartData.map((p: { value: number }) => p.value),
                          1,
                        );
                        const pct = (point.value / max) * 100;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <div
                              className="w-full flex items-end"
                              style={{ height: "120px" }}
                            >
                              <div
                                className="w-full rounded-t-lg bg-[#028090]/80 hover:bg-[#028090] transition-colors"
                                style={{ height: `${Math.max(pct, 4)}%` }}
                                title={`${point.label}: ${point.value}`}
                              />
                            </div>
                            <span className="text-xs text-slate-400 truncate w-full text-center">
                              {point.label}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
