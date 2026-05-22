"use client";

import type { TrendPoint } from "@/lib/compliance-trends";
import { COMPLIANCE_TREND_DAY_OPTIONS } from "@/lib/compliance-trends";

type TrendSeries = {
  days: number;
  from: string;
  to: string;
  alerts: TrendPoint[];
  escalations: TrendPoint[];
  incidents: TrendPoint[];
  visitReviews: TrendPoint[];
  missedVisits: TrendPoint[];
};

const CHARTS: Array<{
  key: keyof Pick<
    TrendSeries,
    "alerts" | "escalations" | "incidents" | "visitReviews" | "missedVisits"
  >;
  title: string;
  color: string;
}> = [
  { key: "alerts", title: "New clinical alerts", color: "#028090" },
  { key: "escalations", title: "New escalations", color: "#dc2626" },
  { key: "incidents", title: "Incidents reported", color: "#ea580c" },
  { key: "visitReviews", title: "Visit reviews opened", color: "#7c3aed" },
  { key: "missedVisits", title: "Missed visits (by schedule date)", color: "#64748b" },
];

function formatAxisLabel(date: string, index: number, total: number) {
  if (total <= 7 || index === 0 || index === total - 1 || index % 7 === 0) {
    const [, month, day] = date.split("-");
    return `${month}/${day}`;
  }
  return "";
}

function MiniBarChart({
  title,
  color,
  data,
}: {
  title: string;
  color: string;
  data: TrendPoint[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-500">{total} total</span>
      </div>
      <div
        className="flex items-end gap-0.5 h-28"
        role="img"
        aria-label={`${title} trend chart`}
      >
        {data.map((point, index) => {
          const heightPct = (point.count / max) * 100;
          return (
            <div
              key={point.date}
              className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group"
            >
              <div
                className="w-full rounded-t transition-opacity group-hover:opacity-80"
                style={{
                  height: point.count ? `${Math.max(heightPct, 6)}%` : "2px",
                  backgroundColor: point.count ? color : "#e2e8f0",
                }}
                title={`${point.date}: ${point.count}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-0.5 mt-1">
        {data.map((point, index) => (
          <div key={`${point.date}-label`} className="flex-1 min-w-0 text-center">
            <span className="text-[9px] text-slate-400 leading-none">
              {formatAxisLabel(point.date, index, data.length)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComplianceTrendCharts({
  trends,
  trendDays,
  onTrendDaysChange,
}: {
  trends: TrendSeries;
  trendDays: number;
  onTrendDaysChange: (days: number) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Trends</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily volume from {trends.from} to {trends.to}
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-white">
          {COMPLIANCE_TREND_DAY_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onTrendDaysChange(days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                trendDays === days
                  ? "bg-[#028090] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHARTS.map((chart) => (
          <MiniBarChart
            key={chart.key}
            title={chart.title}
            color={chart.color}
            data={trends[chart.key]}
          />
        ))}
      </div>
    </section>
  );
}
