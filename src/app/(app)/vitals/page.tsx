"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { formatRelative, riskColor } from "@/lib/utils";
import {
  Activity,
  Heart,
  Wind,
  Thermometer,
  Droplets,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

function VitalCard({
  label,
  value,
  unit,
  icon,
  alert,
}: {
  label: string;
  value?: number | string;
  unit: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${alert ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}
    >
      <div className={`${alert ? "text-red-500" : "text-slate-400"}`}>
        {icon}
      </div>
      <div>
        <p
          className={`text-sm font-bold leading-none ${alert ? "text-red-700" : "text-slate-800"}`}
        >
          {value ?? "—"}{" "}
          {value && <span className="text-xs font-normal">{unit}</span>}
        </p>
        <p
          className={`text-xs mt-0.5 ${alert ? "text-red-500" : "text-slate-400"}`}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

export default function VitalsMonitorPage() {
  const { request, orgId } = useApi();
  const [riskFilter, setRiskFilter] = useState("");

  const params = new URLSearchParams({ limit: "100" });
  if (riskFilter) params.set("riskLevel", riskFilter);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["patients-vitals", orgId, riskFilter],
    queryFn: () =>
      request(`/api/orgs/{orgId}/patients?${params}&status=active`),
    enabled: !!orgId,
    refetchInterval: 60_000, // auto-refresh every minute
  });

  const patients = (data?.data ?? []) as Array<{
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    riskLevel: string;
    primaryDiagnosis?: string;
    latestVital?: {
      systolicBp?: number;
      diastolicBp?: number;
      heartRate?: number;
      oxygenSaturation?: number;
      temperature?: number;
      weight?: number;
      recordedAt: string;
    };
    alerts?: Array<{
      id: string;
      message: string;
      severity: string;
      resolvedAt?: string;
    }>;
  }>;

  const alertCount = patients.filter((p) =>
    p.alerts?.some((a: { resolvedAt?: string }) => !a.resolvedAt),
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#028090]" /> Vitals Monitor
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live vitals overview for active patients
            {alertCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> {alertCount} active
                alert{alertCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
          >
            <option value="">All risk levels</option>
            {["critical", "high", "medium", "low"].map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 text-slate-300 animate-spin" />
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-500">No active patients</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {patients.map(
            (patient: {
              id: string;
              firstName: string;
              lastName: string;
              fullName: string;
              riskLevel: string;
              primaryDiagnosis?: string;
              latestVital?: {
                systolicBp?: number;
                diastolicBp?: number;
                heartRate?: number;
                oxygenSaturation?: number;
                temperature?: number;
                weight?: number;
                recordedAt: string;
              };
              alerts?: Array<{
                id: string;
                message: string;
                severity: string;
                resolvedAt?: string;
              }>;
            }) => {
              const v = patient.latestVital;
              const activeAlerts =
                patient.alerts?.filter((a) => !a.resolvedAt) || [];
              const hasCriticalVital =
                v &&
                ((v.systolicBp && v.systolicBp > 180) ||
                  (v.oxygenSaturation && v.oxygenSaturation < 90) ||
                  (v.heartRate && (v.heartRate < 50 || v.heartRate > 120)));

              return (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className={`bg-white rounded-2xl border p-4 hover:shadow-md transition-all block ${
                    activeAlerts.length > 0 || hasCriticalVital
                      ? "border-red-200 ring-1 ring-red-200/50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {patient.fullName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {patient.primaryDiagnosis || "No diagnosis"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${riskColor(patient.riskLevel)}`}
                    >
                      {patient.riskLevel}
                    </span>
                  </div>

                  {v ? (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <VitalCard
                        label="Blood Pressure"
                        value={
                          v.systolicBp
                            ? `${v.systolicBp}/${v.diastolicBp}`
                            : undefined
                        }
                        unit="mmHg"
                        icon={<Activity className="w-3.5 h-3.5" />}
                        alert={!!(v.systolicBp && v.systolicBp > 180)}
                      />
                      <VitalCard
                        label="Heart Rate"
                        value={v.heartRate}
                        unit="bpm"
                        icon={<Heart className="w-3.5 h-3.5" />}
                        alert={
                          !!(
                            v.heartRate &&
                            (v.heartRate < 50 || v.heartRate > 120)
                          )
                        }
                      />
                      <VitalCard
                        label="SpO₂"
                        value={v.oxygenSaturation}
                        unit="%"
                        icon={<Wind className="w-3.5 h-3.5" />}
                        alert={
                          !!(v.oxygenSaturation && v.oxygenSaturation < 90)
                        }
                      />
                      <VitalCard
                        label="Temperature"
                        value={v.temperature}
                        unit="°F"
                        icon={<Thermometer className="w-3.5 h-3.5" />}
                        alert={
                          !!(
                            v.temperature &&
                            (v.temperature > 101 || v.temperature < 96)
                          )
                        }
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl px-4 py-3 text-center mb-3">
                      <p className="text-xs text-slate-400">
                        No vitals recorded yet
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {v
                        ? `Updated ${formatRelative(v.recordedAt)}`
                        : "No readings"}
                    </span>
                    {activeAlerts.length > 0 && (
                      <span className="flex items-center gap-1 text-red-500 font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        {activeAlerts.length} alert
                        {activeAlerts.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </Link>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
