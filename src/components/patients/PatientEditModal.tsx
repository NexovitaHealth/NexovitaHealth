"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { X, User } from "lucide-react";
import { ADMISSION_SOURCES, admissionSourceLabel } from "@/lib/patients";

type PatientRecord = {
  id: string;
  fullName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  primaryDiagnosis?: string | null;
  primaryDiagnosisIcd10?: string | null;
  admissionSource?: string | null;
  preferredLanguage?: string | null;
  bloodType?: string | null;
  insuranceProvider?: string | null;
  insuranceNumber?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  allergies?: string[];
  isHomeCare?: boolean;
  isHospice?: boolean;
  isPalliative?: boolean;
  riskLevel?: string;
};

interface Props {
  patient: PatientRecord;
  orgId: string;
  onClose: () => void;
}

export function PatientEditModal({ patient, orgId, onClose }: Props) {
  const { request } = useApi();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fullName: patient.fullName ?? "",
    dateOfBirth: patient.dateOfBirth
      ? new Date(patient.dateOfBirth).toISOString().slice(0, 10)
      : "",
    gender: patient.gender ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    address: patient.address ?? "",
    city: patient.city ?? "",
    region: patient.region ?? "",
    primaryDiagnosis: patient.primaryDiagnosis ?? "",
    primaryDiagnosisIcd10: patient.primaryDiagnosisIcd10 ?? "",
    admissionSource: patient.admissionSource ?? "",
    preferredLanguage: patient.preferredLanguage ?? "",
    bloodType: patient.bloodType ?? "",
    insuranceProvider: patient.insuranceProvider ?? "",
    insuranceNumber: patient.insuranceNumber ?? "",
    emergencyContact: patient.emergencyContact ?? "",
    emergencyPhone: patient.emergencyPhone ?? "",
    allergiesText: (patient.allergies ?? []).join(", "),
    isHomeCare: patient.isHomeCare ?? false,
    isHospice: patient.isHospice ?? false,
    isPalliative: patient.isPalliative ?? false,
    riskLevel: patient.riskLevel ?? "low",
  });

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/${orgId}/patients/${patient.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.fullName,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          region: form.region || undefined,
          primaryDiagnosis: form.primaryDiagnosis || undefined,
          primaryDiagnosisIcd10: form.primaryDiagnosisIcd10 || undefined,
          admissionSource: form.admissionSource || undefined,
          preferredLanguage: form.preferredLanguage || undefined,
          bloodType: form.bloodType || undefined,
          insuranceProvider: form.insuranceProvider || undefined,
          insuranceNumber: form.insuranceNumber || undefined,
          emergencyContact: form.emergencyContact || undefined,
          emergencyPhone: form.emergencyPhone || undefined,
          allergies: form.allergiesText
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          isHomeCare: form.isHomeCare,
          isHospice: form.isHospice,
          isPalliative: form.isPalliative,
          riskLevel: form.riskLevel,
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#028090]/10 flex items-center justify-center">
              <User className="w-4 h-4 text-[#028090]" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Edit patient</h2>
              <p className="text-xs text-slate-400">Overview and intake details</p>
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            saveMutation.mutate();
          }}
          className="p-6 space-y-5"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Full name *
              </label>
              <input
                required
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Date of birth
              </label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Gender
              </label>
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="input-base"
              >
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Preferred language
              </label>
              <input
                value={form.preferredLanguage}
                onChange={(e) => set("preferredLanguage", e.target.value)}
                className="input-base"
                placeholder="e.g. English, Spanish"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Admission source
              </label>
              <select
                value={form.admissionSource}
                onChange={(e) => set("admissionSource", e.target.value)}
                className="input-base"
              >
                <option value="">—</option>
                {ADMISSION_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {admissionSourceLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Primary diagnosis
              </label>
              <input
                value={form.primaryDiagnosis}
                onChange={(e) => set("primaryDiagnosis", e.target.value)}
                className="input-base"
                placeholder="Clinical description"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                ICD-10 code
              </label>
              <input
                value={form.primaryDiagnosisIcd10}
                onChange={(e) => set("primaryDiagnosisIcd10", e.target.value)}
                className="input-base"
                placeholder="e.g. I50.9"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Risk level
              </label>
              <select
                value={form.riskLevel}
                onChange={(e) => set("riskLevel", e.target.value)}
                className="input-base"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Allergies (comma-separated)
              </label>
              <input
                value={form.allergiesText}
                onChange={(e) => set("allergiesText", e.target.value)}
                className="input-base"
                placeholder="Penicillin, Latex"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="input-base"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Address
              </label>
              <input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                City
              </label>
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Region / state
              </label>
              <input
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                className="input-base"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
