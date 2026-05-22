"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { Activity, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

type ClinicalAlert = {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  body: string;
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  patient: { id: string; fullName: string; riskLevel?: string };
  vital?: {
    id: string;
    systolicBp?: number | null;
    diastolicBp?: number | null;
    heartRate?: number | null;
  } | null;
};

type AlertsResponse = {
  data: ClinicalAlert[];
  pagination?: { total: number };
  meta?: { openCritical: number };
};

const severityClass: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function AlertsPage() {
  const { request, orgId } = useApi();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [resolvedFilter, setResolvedFilter] = useState<"false" | "true" | "all">(
    "false",
  );
  const [severityFilter, setSeverityFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canView = can("alert:read");
  const canResolve = can("alert:resolve");

  const { data, isLoading } = useQuery({
    queryKey: ["clinical-alerts", orgId, resolvedFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        resolved: resolvedFilter,
        pageSize: "50",
      });
      if (severityFilter) params.set("severity", severityFilter);
      const res = await request<ClinicalAlert[]>(
        `/api/orgs/{orgId}/alerts?${params}`,
      );
      return res as AlertsResponse;
    },
    enabled: !!orgId && canView,
  });

  const alerts = data?.data ?? [];
  const openCritical = data?.meta?.openCritical ?? 0;
  const total = data?.pagination?.total ?? alerts.length;
  const selected = alerts.find((a) => a.id === selectedId) ?? alerts[0];

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) =>
      request(`/api/orgs/{orgId}/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "resolve" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinical-alerts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["supervisor-panel"] });
      setSelectedId(null);
    },
  });

  if (!canView) {
    return (
      <div className="p-8 text-sm text-slate-500">
        You do not have permission to view the clinical alerts queue.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#028090]" />
            Clinical alerts
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Org-wide compliance queue for vitals and clinical threshold breaches
          </p>
        </div>
        {openCritical > 0 && resolvedFilter === "false" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-800 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            {openCritical} critical open
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ["false", "Open"],
            ["true", "Resolved"],
            ["all", "All"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setResolvedFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              resolvedFilter === value
                ? "bg-[#028090] text-white"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
        {(["", "critical", "warning", "info"] as const).map((s) => (
          <button
            key={s || "any"}
            type="button"
            onClick={() => setSeverityFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              severityFilter === s
                ? "bg-slate-800 text-white"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {s || "Any severity"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-slate-500">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
          <p className="font-medium text-slate-700">No alerts in this view</p>
          <p className="text-sm mt-1">
            {resolvedFilter === "false"
              ? "No open clinical alerts — patients are stable."
              : "Try another filter."}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-slate-500 mb-2">{total} alert(s)</p>
            {alerts.map((alert) => (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(alert.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-shadow ${
                    selected?.id === alert.id
                      ? "border-[#028090] shadow-sm bg-teal-50/30"
                      : "border-slate-200 bg-white hover:shadow-sm"
                  }`}
                >
                  <div className="flex justify-between gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${severityClass[alert.severity] ?? ""}`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatRelative(alert.createdAt)}
                    </span>
                  </div>
                  <p className="font-semibold text-sm text-slate-900">
                    {alert.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {alert.patient.fullName} · {alert.alertType.replace(/_/g, " ")}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="bg-white border rounded-2xl p-6 lg:sticky lg:top-6 h-fit">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${severityClass[selected.severity] ?? ""}`}
                  >
                    {selected.severity}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-2">
                    {selected.title}
                  </h2>
                </div>
                {selected.isResolved && (
                  <span className="text-xs text-emerald-700 font-medium">
                    Resolved
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {selected.body}
              </p>

              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">Patient</dt>
                  <dd>
                    <Link
                      href={`/patients/${selected.patient.id}`}
                      className="text-[#028090] font-medium hover:underline"
                    >
                      {selected.patient.fullName}
                    </Link>
                    {selected.patient.riskLevel && (
                      <span className="ml-2 text-xs text-slate-500 capitalize">
                        ({selected.patient.riskLevel} risk)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Type</dt>
                  <dd className="capitalize">
                    {selected.alertType.replace(/_/g, " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd>{formatDateTime(selected.createdAt)}</dd>
                </div>
                {selected.vital && (
                  <div>
                    <dt className="text-slate-500">Linked vitals</dt>
                    <dd>
                      {[
                        selected.vital.systolicBp != null &&
                          `BP ${selected.vital.systolicBp}/${selected.vital.diastolicBp}`,
                        selected.vital.heartRate != null &&
                          `HR ${selected.vital.heartRate}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "See patient chart"}
                    </dd>
                  </div>
                )}
                {selected.resolvedAt && (
                  <div>
                    <dt className="text-slate-500">Resolved</dt>
                    <dd>{formatDateTime(selected.resolvedAt)}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href={`/patients/${selected.patient.id}`}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700"
                >
                  Open patient chart
                </Link>
                {!selected.isResolved && canResolve && (
                  <button
                    type="button"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate(selected.id)}
                    className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
                  >
                    {resolveMutation.isPending ? "Resolving…" : "Mark resolved"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
