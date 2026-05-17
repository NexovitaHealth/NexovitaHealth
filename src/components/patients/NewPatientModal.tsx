"use client";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { X, User } from "lucide-react";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function NewPatientModal({ onClose, onSuccess }: Props) {
  const { request, orgId } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    primaryDiagnosis: "",
    bloodType: "",
    insuranceProvider: "",
    insuranceNumber: "",
    emergencyContact: "",
    emergencyPhone: "",
    isHomeCare: true,
    isHospice: false,
    isPalliative: false,
    riskLevel: "low",
  });

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await request(`/api/orgs/${orgId}/patients`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
              <h2 className="font-semibold text-slate-900">
                Admit New Patient
              </h2>
              <p className="text-xs text-slate-400">
                Fill in patient information
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Full Name *
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
                  Date of Birth
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
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other / Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="input-base"
                  placeholder="+1 555-0100"
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
                  placeholder="patient@email.com"
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
                  placeholder="123 Main St"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Clinical Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Primary Diagnosis
                </label>
                <input
                  value={form.primaryDiagnosis}
                  onChange={(e) => set("primaryDiagnosis", e.target.value)}
                  className="input-base"
                  placeholder="e.g. CHF - Congestive Heart Failure"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Risk Level
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
                  Blood Type
                </label>
                <select
                  value={form.bloodType}
                  onChange={(e) => set("bloodType", e.target.value)}
                  className="input-base"
                >
                  <option value="">Unknown</option>
                  {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Care Type
                </label>
                <div className="flex gap-4">
                  {[
                    { key: "isHomeCare", label: "Home Care" },
                    { key: "isHospice", label: "Hospice" },
                    { key: "isPalliative", label: "Palliative" },
                  ].map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form[opt.key as keyof typeof form] as boolean}
                        onChange={(e) => set(opt.key, e.target.checked)}
                        className="rounded border-slate-300 text-[#028090] focus:ring-[#028090]"
                      />
                      <span className="text-sm text-slate-600">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Contact Name
                </label>
                <input
                  value={form.emergencyContact}
                  onChange={(e) => set("emergencyContact", e.target.value)}
                  className="input-base"
                  placeholder="Contact name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Contact Phone
                </label>
                <input
                  value={form.emergencyPhone}
                  onChange={(e) => set("emergencyPhone", e.target.value)}
                  className="input-base"
                  placeholder="+1 555-0101"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-50"
            >
              {loading ? "Admitting..." : "Admit Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
