"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { X, Pill } from "lucide-react";

export type MedicationRecord = {
  id?: string;
  name: string;
  genericName?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string | null;
  isActive?: boolean;
};

interface Props {
  patientId: string;
  orgId: string;
  medication?: MedicationRecord;
  onClose: () => void;
}

export function MedicationModal({
  patientId,
  orgId,
  medication,
  onClose,
}: Props) {
  const { request } = useApi();
  const queryClient = useQueryClient();
  const isEdit = !!medication?.id;
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: medication?.name ?? "",
    genericName: medication?.genericName ?? "",
    dosage: medication?.dosage ?? "",
    frequency: medication?.frequency ?? "",
    route: medication?.route ?? "",
    startDate: medication?.startDate
      ? new Date(medication.startDate).toISOString().slice(0, 10)
      : "",
    endDate: medication?.endDate
      ? new Date(medication.endDate).toISOString().slice(0, 10)
      : "",
    instructions: medication?.instructions ?? "",
    isActive: medication?.isActive ?? true,
  });

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        genericName: form.genericName.trim() || undefined,
        dosage: form.dosage.trim() || undefined,
        frequency: form.frequency.trim() || undefined,
        route: form.route.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        instructions: form.instructions.trim() || undefined,
        isActive: form.isActive,
      };

      if (isEdit && medication?.id) {
        return request(
          `/api/orgs/${orgId}/patients/${patientId}/medications/${medication.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
      }

      return request(`/api/orgs/${orgId}/patients/${patientId}/medications`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary-600" />
            {isEdit ? "Edit Medication" : "Add Medication"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            saveMutation.mutate();
          }}
        >
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="label">Medication name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Generic name</label>
            <input
              className="input"
              value={form.genericName}
              onChange={(e) => set("genericName", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dosage</label>
              <input
                className="input"
                value={form.dosage}
                onChange={(e) => set("dosage", e.target.value)}
                placeholder="e.g. 10mg"
              />
            </div>
            <div>
              <label className="label">Frequency</label>
              <input
                className="input"
                value={form.frequency}
                onChange={(e) => set("frequency", e.target.value)}
                placeholder="e.g. BID"
              />
            </div>
          </div>
          <div>
            <label className="label">Route</label>
            <input
              className="input"
              value={form.route}
              onChange={(e) => set("route", e.target.value)}
              placeholder="e.g. oral"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                type="date"
                className="input"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Instructions</label>
            <textarea
              className="input min-h-[80px]"
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
              />
              Active medication
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saveMutation.isPending || !form.name.trim()}
            >
              {saveMutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add medication"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
