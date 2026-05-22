"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { AlertTriangle, Loader2, Plus } from "lucide-react";

type Escalation = {
  id: string;
  status: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  clinicalResponse?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  patient: { id: string; fullName: string };
  createdBy: { fullName: string };
  assignedTo?: { fullName: string } | null;
  incident?: { id: string; incidentType: string; status: string } | null;
};

const REVIEWER_ROLES = [
  "agency_admin",
  "supervisor",
  "physician",
  "physician_independent",
];

const severityClass: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-slate-100 text-slate-700",
};

export default function EscalationsPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clinicalResponse, setClinicalResponse] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    patientId: "",
    category: "clinical",
    title: "",
    description: "",
    severity: "warning" as "info" | "warning" | "critical",
  });

  const canReview = REVIEWER_ROLES.includes(user?.role || "");

  const { data: patientsData } = useQuery({
    queryKey: ["patients", orgId, "escalations"],
    queryFn: () => request<{ id: string; fullName: string }[]>(`/api/orgs/{orgId}/patients?pageSize=200`),
    enabled: !!orgId && canReview && showCreate,
  });
  const patients = (patientsData?.data as { id: string; fullName: string }[]) || [];

  const { data, isLoading } = useQuery({
    queryKey: ["escalations", orgId, statusFilter],
    queryFn: () =>
      request<Escalation[]>(
        `/api/orgs/{orgId}/escalations?status=${statusFilter}&pageSize=50`,
      ),
    enabled: !!orgId && canReview,
  });

  const escalations = (data?.data as Escalation[]) || [];
  const selected =
    escalations.find((e) => e.id === selectedId) ?? escalations[0];

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      status: "in_review" | "resolved" | "cancelled";
      clinicalResponse?: string;
    }) =>
      request(`/api/orgs/{orgId}/escalations/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: payload.status,
          clinicalResponse: payload.clinicalResponse,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalations"] });
      setClinicalResponse("");
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/{orgId}/escalations`, {
        method: "POST",
        body: JSON.stringify(createForm),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalations"] });
      setShowCreate(false);
      setCreateForm({
        patientId: "",
        category: "clinical",
        title: "",
        description: "",
        severity: "warning",
      });
    },
  });

  if (!canReview) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Escalation review is limited to clinical reviewers.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#028090]" />
            Clinical escalations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Triage open escalations and document clinical response.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New escalation
        </button>
      </div>

      {showCreate && (
        <form
          className="mb-6 bg-white border border-slate-100 rounded-2xl p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <h2 className="font-semibold text-slate-900">Create escalation</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-slate-600">Patient</span>
              <select
                required
                value={createForm.patientId}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, patientId: e.target.value }))
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
              <span className="text-slate-600">Category</span>
              <input
                required
                value={createForm.category}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, category: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">Title</span>
              <input
                required
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, title: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Severity</span>
              <select
                value={createForm.severity}
                onChange={(e) =>
                  setCreateForm((f) => ({
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
              <span className="text-slate-600">Description</span>
              <textarea
                required
                rows={3}
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving…" : "Create escalation"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(["open", "in_review", "resolved", "cancelled"] as const).map((s) => (
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
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : escalations.length === 0 ? (
        <p className="text-sm text-slate-500">No escalations in this queue.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <ul className="space-y-2">
            {escalations.map((esc) => (
              <li key={esc.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(esc.id);
                    setClinicalResponse(esc.clinicalResponse || "");
                  }}
                  className={`w-full text-left rounded-xl border p-4 ${
                    (selectedId ?? escalations[0]?.id) === esc.id
                      ? "border-[#028090] bg-teal-50/40"
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{esc.title}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${severityClass[esc.severity] || severityClass.info}`}
                    >
                      {esc.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {esc.patient.fullName} · {esc.category}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 capitalize">
                    {esc.status} · {formatDateTime(esc.createdAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900 mb-2">{selected.title}</h2>
              <Link
                href={`/patients/${selected.patient.id}`}
                className="text-sm text-[#028090] hover:underline"
              >
                {selected.patient.fullName}
              </Link>
              <p className="text-sm text-slate-600 mt-4 whitespace-pre-wrap">
                {selected.description}
              </p>
              <dl className="text-sm space-y-2 mt-4">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Reported by</dt>
                  <dd>{selected.createdBy.fullName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Assigned</dt>
                  <dd>{selected.assignedTo?.fullName || "Unassigned"}</dd>
                </div>
                {selected.incident && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Linked incident</dt>
                    <dd className="capitalize">{selected.incident.incidentType}</dd>
                  </div>
                )}
              </dl>

              {selected.status !== "resolved" &&
                selected.status !== "cancelled" && (
                  <>
                    <label className="block text-sm mt-4">
                      <span className="text-slate-600">Clinical response</span>
                      <textarea
                        rows={3}
                        value={clinicalResponse}
                        onChange={(e) => setClinicalResponse(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {selected.status === "open" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: selected.id,
                              status: "in_review",
                              clinicalResponse: clinicalResponse || undefined,
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium"
                        >
                          Assign to me
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: selected.id,
                            status: "resolved",
                            clinicalResponse: clinicalResponse || undefined,
                          })
                        }
                        disabled={updateMutation.isPending}
                        className="px-3 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: selected.id,
                            status: "cancelled",
                          })
                        }
                        disabled={updateMutation.isPending}
                        className="px-3 py-2 rounded-lg text-sm text-slate-500"
                      >
                        Cancel
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
