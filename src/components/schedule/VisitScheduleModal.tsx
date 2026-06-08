"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Calendar, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { orgApi } from "@/lib/api-client";
import { VISIT_TYPES } from "@/components/schedule/visit-types";

export type ScheduleVisit = {
  id: string;
  patientId: string;
  staffId: string;
  scheduledAt: string;
  visitType: string;
  status: string;
  notes?: string | null;
  serviceAddress?: string | null;
  lockedAt?: string | null;
  patient?: { id: string; fullName: string };
  caregiver?: { id: string; fullName: string };
};

type Props = {
  mode: "create" | "edit";
  orgId: string;
  defaultDate?: string;
  visit?: ScheduleVisit;
  onClose: () => void;
};

function datePart(iso: string) {
  return iso.slice(0, 10);
}

function timePart(iso: string) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function toScheduledAtIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function VisitScheduleModal({
  mode,
  orgId,
  defaultDate,
  visit,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const { request } = useApi();
  const [error, setError] = useState("");

  const locked = Boolean(visit?.lockedAt);
  const editable =
    mode === "create" ||
    (visit && !locked && ["scheduled", "in_progress"].includes(visit.status));

  const [form, setForm] = useState({
    patientId: visit?.patientId ?? "",
    staffId: visit?.staffId ?? "",
    visitType: visit?.visitType ?? "personal_care",
    date: visit ? datePart(visit.scheduledAt) : defaultDate ?? "",
    time: visit ? timePart(visit.scheduledAt) : "09:00",
    notes: visit?.notes ?? "",
    serviceAddress: visit?.serviceAddress ?? "",
    status: visit?.status ?? "scheduled",
  });

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["patients", orgId, "schedule-form"],
    queryFn: () =>
      request<Array<{ id: string; fullName: string; address?: string | null }>>(
        `/api/orgs/{orgId}/patients?pageSize=200`,
      ),
    enabled: mode === "create" && !!orgId,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["members", orgId, "schedule-form"],
    queryFn: () =>
      request<
        Array<{ id: string; fullName: string; role: string; isActive: boolean }>
      >(`/api/orgs/{orgId}/members`),
    enabled: !!orgId,
  });

  const patients = useMemo(
    () =>
      (patientsData?.data as Array<{ id: string; fullName: string; address?: string | null }>) ??
      [],
    [patientsData?.data],
  );
  const members = (
    (membersData?.data as Array<{
      id: string;
      fullName: string;
      role: string;
      isActive: boolean;
    }>) ?? []
  ).filter((m) => m.isActive);

  useEffect(() => {
    if (mode !== "create" || !form.patientId) return;
    const patient = patients.find((p) => p.id === form.patientId);
    if (patient?.address && !form.serviceAddress) {
      setForm((f) => ({ ...f, serviceAddress: patient.address ?? "" }));
    }
  }, [form.patientId, patients, mode, form.serviceAddress]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = toScheduledAtIso(form.date, form.time);
      if (mode === "create") {
        return orgApi(orgId).visits.create({
          patientId: form.patientId,
          staffId: form.staffId,
          visitType: form.visitType,
          scheduledAt,
          notes: form.notes || undefined,
          serviceAddress: form.serviceAddress || undefined,
        });
      }
      if (!visit) throw new Error("Visit not found");
      return orgApi(orgId).visits.update(visit.id, {
        visitType: form.visitType,
        scheduledAt,
        notes: form.notes || undefined,
        serviceAddress: form.serviceAddress || undefined,
        status: form.status as
          | "scheduled"
          | "in_progress"
          | "completed"
          | "missed"
          | "cancelled",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.date || !form.time) {
      setError("Date and time are required");
      return;
    }
    if (mode === "create" && (!form.patientId || !form.staffId)) {
      setError("Patient and assigned staff are required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#028090]/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-[#028090]" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">
                {mode === "create" ? "Schedule visit" : "Edit visit"}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === "create"
                  ? "Assign patient, aide, and time"
                  : locked
                    ? "Visit is locked after submission"
                    : "Update visit details"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {mode === "create" ? (
            <>
              <label className="block text-sm">
                <span className="text-slate-600 font-medium">Patient</span>
                <select
                  required
                  disabled={patientsLoading}
                  value={form.patientId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, patientId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
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
                <span className="text-slate-600 font-medium">Assigned staff</span>
                <select
                  required
                  disabled={membersLoading}
                  value={form.staffId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staffId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Select staff</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.role.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            visit && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700">
                <p>
                  <span className="text-slate-500">Patient:</span>{" "}
                  {visit.patient?.fullName}
                </p>
                <p className="mt-1">
                  <span className="text-slate-500">Staff:</span>{" "}
                  {visit.caregiver?.fullName}
                </p>
              </div>
            )
          )}

          <label className="block text-sm">
            <span className="text-slate-600 font-medium">Visit type</span>
            <select
              required
              disabled={!editable}
              value={form.visitType}
              onChange={(e) =>
                setForm((f) => ({ ...f, visitType: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
            >
              {VISIT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-600 font-medium">Date</span>
              <input
                type="date"
                required
                disabled={!editable}
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 font-medium">Time</span>
              <input
                type="time"
                required
                disabled={!editable}
                value={form.time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, time: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
              />
            </label>
          </div>

          {mode === "edit" && editable && (
            <label className="block text-sm">
              <span className="text-slate-600 font-medium">Status</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          )}

          <label className="block text-sm">
            <span className="text-slate-600 font-medium">Service address</span>
            <input
              type="text"
              disabled={!editable}
              value={form.serviceAddress}
              onChange={(e) =>
                setForm((f) => ({ ...f, serviceAddress: e.target.value }))
              }
              placeholder="Patient home or service location"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-600 font-medium">Notes</span>
            <textarea
              rows={3}
              disabled={!editable}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600"
            >
              {editable ? "Cancel" : "Close"}
            </button>
            {editable && (
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saveMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {mode === "create" ? "Schedule visit" : "Save changes"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
