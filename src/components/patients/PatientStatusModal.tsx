"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { X, ArrowRightLeft } from "lucide-react";
import {
  DISCHARGE_DISPOSITIONS,
  PATIENT_STATUSES,
  admissionSourceLabel,
} from "@/lib/patients";

type PatientRecord = {
  id: string;
  fullName: string;
  status: string;
  dischargeReason?: string | null;
  dischargeDisposition?: string | null;
  dischargeDate?: string | null;
};

interface Props {
  patient: PatientRecord;
  orgId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  intake: "Intake",
  active: "Active",
  on_hold: "On hold",
  discharged: "Discharged",
  deceased: "Deceased",
};

export function PatientStatusModal({ patient, orgId, onClose }: Props) {
  const { request } = useApi();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [status, setStatus] = useState(patient.status);
  const [dischargeReason, setDischargeReason] = useState(
    patient.dischargeReason ?? "",
  );
  const [dischargeDisposition, setDischargeDisposition] = useState(
    patient.dischargeDisposition ?? "",
  );
  const [dischargeDate, setDischargeDate] = useState(
    patient.dischargeDate
      ? new Date(patient.dischargeDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );

  const terminal = status === "discharged" || status === "deceased";

  const saveMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/${orgId}/patients/${patient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(terminal && {
            dischargeReason: dischargeReason.trim(),
            dischargeDisposition: dischargeDisposition || undefined,
            dischargeDate,
          }),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", orgId, patient.id] });
      queryClient.invalidateQueries({ queryKey: ["patients", orgId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-5 h-5 text-[#028090]" />
            <div>
              <h2 className="font-semibold text-slate-900">Change status</h2>
              <p className="text-xs text-slate-400">{patient.fullName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            saveMutation.mutate();
          }}
          className="p-6 space-y-4"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              New status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-base"
            >
              {PATIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Current: {STATUS_LABELS[patient.status] ?? patient.status}
            </p>
          </div>

          {status === "active" && patient.status === "intake" && (
            <p className="text-sm text-slate-600 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
              Activating will confirm admission date if not already set.
            </p>
          )}

          {terminal && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Discharge reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={dischargeReason}
                  onChange={(e) => setDischargeReason(e.target.value)}
                  className="input-base resize-none"
                  placeholder="Clinical summary and reason for discharge or death"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Disposition
                </label>
                <select
                  value={dischargeDisposition}
                  onChange={(e) => setDischargeDisposition(e.target.value)}
                  className="input-base"
                >
                  <option value="">Select disposition</option>
                  {DISCHARGE_DISPOSITIONS.map((d) => (
                    <option key={d} value={d}>
                      {admissionSourceLabel(d)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Discharge date
                </label>
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  className="input-base"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending || (terminal && !dischargeReason.trim())}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {saveMutation.isPending ? "Updating…" : "Update status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
