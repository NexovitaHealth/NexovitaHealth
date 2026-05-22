"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { FileWarning, Loader2, Plus } from "lucide-react";

type Incident = {
  id: string;
  status: string;
  severity: string;
  incidentType: string;
  description: string;
  immediateAction?: string | null;
  resolution?: string | null;
  occurredAt: string;
  createdAt: string;
  patient: { id: string; fullName: string };
  reportedBy: { fullName: string };
  assignedTo?: { fullName: string } | null;
  escalations?: { id: string; title: string; status: string }[];
};

const REPORTER_ROLES = [
  "agency_admin",
  "supervisor",
  "physician",
  "physician_independent",
  "aide",
  "school_nurse",
];

const REVIEWER_ROLES = [
  "agency_admin",
  "supervisor",
  "physician",
  "physician_independent",
];

const INCIDENT_TYPES = [
  "Fall",
  "Medication error",
  "Skin breakdown",
  "Behavioral",
  "Equipment failure",
  "Missed visit",
  "Other",
];

const severityClass: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-slate-100 text-slate-700",
};

export default function IncidentsPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("reported");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({
    patientId: "",
    incidentType: "Fall",
    description: "",
    severity: "warning" as "info" | "warning" | "critical",
    immediateAction: "",
    occurredAt: new Date().toISOString().slice(0, 16),
    createEscalation: true,
  });

  const canReport = REPORTER_ROLES.includes(user?.role || "");
  const canTriage = REVIEWER_ROLES.includes(user?.role || "");

  const { data: patientsData } = useQuery({
    queryKey: ["patients", orgId, "incidents"],
    queryFn: () =>
      request<{ id: string; fullName: string }[]>(
        `/api/orgs/{orgId}/patients?pageSize=200`,
      ),
    enabled: !!orgId && canReport && showReport,
  });
  const patients = (patientsData?.data as { id: string; fullName: string }[]) || [];

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", orgId, statusFilter],
    queryFn: () =>
      request<Incident[]>(
        `/api/orgs/{orgId}/incidents?status=${statusFilter}&pageSize=50`,
      ),
    enabled: !!orgId && canReport,
  });

  const incidents = (data?.data as Incident[]) || [];
  const selected =
    incidents.find((i) => i.id === selectedId) ?? incidents[0];

  const reportMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/{orgId}/incidents`, {
        method: "POST",
        body: JSON.stringify({
          ...reportForm,
          occurredAt: new Date(reportForm.occurredAt).toISOString(),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["escalations"] });
      setShowReport(false);
      setReportForm({
        patientId: "",
        incidentType: "Fall",
        description: "",
        severity: "warning",
        immediateAction: "",
        occurredAt: new Date().toISOString().slice(0, 16),
        createEscalation: true,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      status: "triaged" | "resolved" | "closed";
      resolution?: string;
    }) =>
      request(`/api/orgs/{orgId}/incidents/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: payload.status,
          resolution: payload.resolution,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      setResolution("");
    },
  });

  if (!canReport) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Incident reporting is not available for your role.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileWarning className="w-6 h-6 text-[#028090]" />
            Incidents & concerns
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Report safety events; supervisors triage and close the loop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowReport((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Report incident
        </button>
      </div>

      {showReport && (
        <form
          className="mb-6 bg-white border border-slate-100 rounded-2xl p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            reportMutation.mutate();
          }}
        >
          <h2 className="font-semibold text-slate-900">New incident report</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-slate-600">Patient</span>
              <select
                required
                value={reportForm.patientId}
                onChange={(e) =>
                  setReportForm((f) => ({ ...f, patientId: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="">Select patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Type</span>
              <select
                value={reportForm.incidentType}
                onChange={(e) =>
                  setReportForm((f) => ({ ...f, incidentType: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">When it occurred</span>
              <input
                type="datetime-local"
                required
                value={reportForm.occurredAt}
                onChange={(e) =>
                  setReportForm((f) => ({ ...f, occurredAt: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Severity</span>
              <select
                value={reportForm.severity}
                onChange={(e) =>
                  setReportForm((f) => ({
                    ...f,
                    severity: e.target.value as "info" | "warning" | "critical",
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">What happened</span>
              <textarea
                required
                rows={3}
                value={reportForm.description}
                onChange={(e) =>
                  setReportForm((f) => ({ ...f, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">Immediate action taken</span>
              <textarea
                rows={2}
                value={reportForm.immediateAction}
                onChange={(e) =>
                  setReportForm((f) => ({
                    ...f,
                    immediateAction: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={reportForm.createEscalation}
                onChange={(e) =>
                  setReportForm((f) => ({
                    ...f,
                    createEscalation: e.target.checked,
                  }))
                }
              />
              <span className="text-slate-600">
                Open clinical escalation for warning/critical incidents
              </span>
            </label>
          </div>
          <button
            type="submit"
            disabled={reportMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
          >
            {reportMutation.isPending ? "Submitting…" : "Submit report"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["reported", "triaged", "resolved", "closed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              statusFilter === s
                ? "bg-[#028090] text-white"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : incidents.length === 0 ? (
        <p className="text-sm text-slate-500">No incidents in this queue.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <ul className="space-y-2">
            {incidents.map((inc) => (
              <li key={inc.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(inc.id);
                    setResolution(inc.resolution || "");
                  }}
                  className={`w-full text-left rounded-xl border p-4 ${
                    (selectedId ?? incidents[0]?.id) === inc.id
                      ? "border-[#028090] bg-teal-50/40"
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {inc.incidentType}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${severityClass[inc.severity] || severityClass.info}`}
                    >
                      {inc.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {inc.patient.fullName}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 capitalize">
                    {inc.status} · {formatDateTime(inc.occurredAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900 mb-2 capitalize">
                {selected.incidentType}
              </h2>
              <Link
                href={`/patients/${selected.patient.id}`}
                className="text-sm text-[#028090] hover:underline"
              >
                {selected.patient.fullName}
              </Link>
              <p className="text-sm text-slate-600 mt-4 whitespace-pre-wrap">
                {selected.description}
              </p>
              {selected.immediateAction && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mt-3">
                  <span className="font-medium text-slate-700">
                    Immediate action:{" "}
                  </span>
                  {selected.immediateAction}
                </p>
              )}
              <dl className="text-sm space-y-2 mt-4">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Reported by</dt>
                  <dd>{selected.reportedBy.fullName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Occurred</dt>
                  <dd>{formatDateTime(selected.occurredAt)}</dd>
                </div>
                {selected.escalations && selected.escalations.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Escalation</dt>
                    <dd>
                      <Link href="/escalations" className="text-[#028090] hover:underline">
                        {selected.escalations[0].title}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>

              {canTriage &&
                selected.status !== "resolved" &&
                selected.status !== "closed" && (
                  <>
                    <label className="block text-sm mt-4">
                      <span className="text-slate-600">Resolution notes</span>
                      <textarea
                        rows={3}
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {selected.status === "reported" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: selected.id,
                              status: "triaged",
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium"
                        >
                          Triage
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: selected.id,
                            status: "resolved",
                            resolution: resolution || undefined,
                          })
                        }
                        disabled={updateMutation.isPending}
                        className="px-3 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
                      >
                        Resolve
                      </button>
                    </div>
                  </>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
