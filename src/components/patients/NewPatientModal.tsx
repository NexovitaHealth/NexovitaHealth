"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, User, X } from "lucide-react";
import {
  ADMISSION_SOURCES,
  INTAKE_STEPS,
  admissionSourceLabel,
  initialIntakeFormState,
  intakeFormToCreatePayload,
  intakeReviewRows,
  validateIntakeStep,
  type IntakeFormState,
} from "@/lib/patient-intake";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

type BranchRow = {
  id: string;
  name: string;
  city?: string | null;
  region?: string | null;
};

export function NewPatientModal({ onClose, onSuccess }: Props) {
  const router = useRouter();
  const { request, orgId } = useApi();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<IntakeFormState>(initialIntakeFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["org-branches", orgId],
    queryFn: async () => {
      const res = await request<BranchRow[]>(`/api/orgs/${orgId}/branches`);
      return res.data ?? [];
    },
    enabled: !!orgId,
  });

  const requireBranch = branches.length > 0;
  const step = INTAKE_STEPS[stepIndex];
  const branchName = branches.find((b) => b.id === form.branchId)?.name;

  const set = (k: keyof IntakeFormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const goNext = () => {
    const message = validateIntakeStep(step.id, form, { requireBranch });
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStepIndex((i) => Math.min(i + 1, INTAKE_STEPS.length - 1));
  };

  const goBack = () => {
    setError("");
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async () => {
    const message = validateIntakeStep("review", form, { requireBranch });
    if (message) {
      setError(message);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = intakeFormToCreatePayload(form);
      const res = await request<{ id: string }>(`/api/orgs/${orgId}/patients`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const patientId = res.data?.id;
      onSuccess();
      if (patientId) {
        router.push(`/patients/${patientId}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Admission failed");
    } finally {
      setLoading(false);
    }
  };

  const reviewRows = intakeReviewRows(form, branchName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#028090]/10 flex items-center justify-center">
              <User className="w-4 h-4 text-[#028090]" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Patient intake</h2>
              <p className="text-xs text-slate-400">
                Step {stepIndex + 1} of {INTAKE_STEPS.length} — {step.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="shrink-0 px-6 py-3 border-b border-slate-50 flex gap-1 overflow-x-auto">
          {INTAKE_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 min-w-[4rem] h-1 rounded-full ${
                i <= stepIndex ? "bg-[#028090]" : "bg-slate-200"
              }`}
              title={s.title}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {step.id === "placement" && (
            <StepPlacement
              form={form}
              set={set}
              branches={branches}
              branchesLoading={branchesLoading}
              requireBranch={requireBranch}
            />
          )}
          {step.id === "identity" && <StepIdentity form={form} set={set} />}
          {step.id === "contact" && <StepContact form={form} set={set} />}
          {step.id === "clinical" && <StepClinical form={form} set={set} />}
          {step.id === "coverage" && <StepCoverage form={form} set={set} />}
          {step.id === "review" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Review the intake summary. The patient will be created in{" "}
                <span className="font-medium text-slate-800">intake</span> status
                with today&apos;s admission date.
              </p>
              <dl className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {reviewRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between gap-4 px-4 py-2.5 text-sm"
                  >
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="text-slate-800 text-right font-medium">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex-1" />
          {step.id !== "review" ? (
            <button
              type="button"
              onClick={goNext}
              className="btn-primary py-2.5 px-5 text-sm flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50"
            >
              {loading ? "Admitting…" : "Complete intake"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepPlacement({
  form,
  set,
  branches,
  branchesLoading,
  requireBranch,
}: {
  form: IntakeFormState;
  set: (k: keyof IntakeFormState, v: string | boolean) => void;
  branches: BranchRow[];
  branchesLoading: boolean;
  requireBranch: boolean;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">{INTAKE_STEPS[0].description}</p>
      {branchesLoading ? (
        <p className="text-sm text-slate-400">Loading branches…</p>
      ) : requireBranch ? (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Location *
          </label>
          <select
            required
            value={form.branchId}
            onChange={(e) => set("branchId", e.target.value)}
            className="input-base"
          >
            <option value="">Select location</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.city ? ` — ${b.city}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          No locations configured for this agency. You can add locations in org
          settings later; admission will proceed without a location.
        </p>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Admission source
        </label>
        <select
          value={form.admissionSource}
          onChange={(e) => set("admissionSource", e.target.value)}
          className="input-base"
        >
          <option value="">Select source</option>
          {ADMISSION_SOURCES.map((s) => (
            <option key={s} value={s}>
              {admissionSourceLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <CareTypeCheckboxes form={form} set={set} />
    </div>
  );
}

function StepIdentity({
  form,
  set,
}: {
  form: IntakeFormState;
  set: (k: keyof IntakeFormState, v: string | boolean) => void;
}) {
  return (
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
          placeholder="Jane Doe"
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
          <option value="">Select</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other / Non-binary</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </div>
      <div className="col-span-2">
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
    </div>
  );
}

function StepContact({
  form,
  set,
}: {
  form: IntakeFormState;
  set: (k: keyof IntakeFormState, v: string | boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
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
          Street address
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
          State / region
        </label>
        <input
          value={form.region}
          onChange={(e) => set("region", e.target.value)}
          className="input-base"
        />
      </div>
    </div>
  );
}

function StepClinical({
  form,
  set,
}: {
  form: IntakeFormState;
  set: (k: keyof IntakeFormState, v: string | boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Primary diagnosis
        </label>
        <input
          value={form.primaryDiagnosis}
          onChange={(e) => set("primaryDiagnosis", e.target.value)}
          className="input-base"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          ICD-10
        </label>
        <input
          value={form.primaryDiagnosisIcd10}
          onChange={(e) => set("primaryDiagnosisIcd10", e.target.value)}
          className="input-base"
          placeholder="I50.9"
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
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Blood type
        </label>
        <select
          value={form.bloodType}
          onChange={(e) => set("bloodType", e.target.value)}
          className="input-base"
        >
          <option value="">Unknown</option>
          {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
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
    </div>
  );
}

function StepCoverage({
  form,
  set,
}: {
  form: IntakeFormState;
  set: (k: keyof IntakeFormState, v: string | boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Insurance provider
          </label>
          <input
            value={form.insuranceProvider}
            onChange={(e) => set("insuranceProvider", e.target.value)}
            className="input-base"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Policy / member ID
          </label>
          <input
            value={form.insuranceNumber}
            onChange={(e) => set("insuranceNumber", e.target.value)}
            className="input-base"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Emergency contact
          </label>
          <input
            value={form.emergencyContact}
            onChange={(e) => set("emergencyContact", e.target.value)}
            className="input-base"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Emergency phone
          </label>
          <input
            value={form.emergencyPhone}
            onChange={(e) => set("emergencyPhone", e.target.value)}
            className="input-base"
          />
        </div>
      </div>
    </div>
  );
}

function CareTypeCheckboxes({
  form,
  set,
}: {
  form: IntakeFormState;
  set: (k: keyof IntakeFormState, v: string | boolean) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">
        Care program
      </label>
      <div className="flex flex-wrap gap-4">
        {(
          [
            { key: "isHomeCare", label: "Home care" },
            { key: "isHospice", label: "Hospice" },
            { key: "isPalliative", label: "Palliative" },
          ] as const
        ).map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form[opt.key]}
              onChange={(e) => set(opt.key, e.target.checked)}
              className="rounded border-slate-300 text-[#028090] focus:ring-[#028090]"
            />
            <span className="text-sm text-slate-600">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
