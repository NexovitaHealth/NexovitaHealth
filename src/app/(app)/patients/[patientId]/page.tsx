"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import {
  ChevronLeft,
  AlertTriangle,
  Activity,
  ClipboardList,
  Heart,
  FileText,
  Users,
  Pill,
  FlaskConical,
  Calendar,
  Edit,
  Phone,
  Mail,
  MapPin,
  Link2,
  Loader2,
  Check,
} from "lucide-react";
import {
  riskColor,
  statusColor,
  formatDate,
  formatRelative,
} from "@/lib/utils";
import Link from "next/link";
import { ClinicalTabPanel } from "@/components/clinical/ClinicalTabPanel";

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "clinical", label: "Care Plan", icon: ClipboardList },
  { id: "vitals", label: "Vitals", icon: Activity },
  { id: "medications", label: "Medications", icon: Pill },
  { id: "labs", label: "Labs", icon: FlaskConical },
  { id: "care_team", label: "Care Team", icon: Users },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
];

export default function PatientChartPage() {
  const { patientId } = useParams();
  const { request, orgId } = useApi();
  const { user, activeOrg } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [portalError, setPortalError] = useState("");

  const canIssuePortal =
    ["owner", "admin"].includes(activeOrg?.role || "") ||
    ["agency_admin", "supervisor", "superadmin"].includes(user?.role || "");

  const issuePortalMutation = useMutation({
    mutationFn: () =>
      request<{ portalUrl: string; token: string }>(
        `/api/orgs/${orgId}/patients/${patientId}/portal-access`,
        { method: "POST" },
      ),
    onSuccess: (res) => {
      setPortalLink(res.data?.portalUrl ?? null);
      setPortalError("");
    },
    onError: (err: Error) => {
      setPortalError(err.message);
      setPortalLink(null);
    },
  });

  const { data: patientResponse, isLoading } = useQuery({
    queryKey: ["patient", orgId, patientId],
    queryFn: () => request(`/api/orgs/${orgId}/patients/${patientId}`),
    enabled: !!orgId && !!patientId,
  });

  const { data: vitals } = useQuery({
    queryKey: ["vitals", orgId, patientId],
    queryFn: () =>
      request<any>(`/api/orgs/${orgId}/patients/${patientId}/vitals?limit=10`),
    enabled: !!orgId && !!patientId && activeTab === "vitals",
  });

  type PatientDetail = {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    riskLevel: string;
    status: string;
    primaryDiagnosis?: string;
    dateOfBirth?: string;
    gender?: string;
    admissionDate?: string;
    phone?: string;
    email?: string;
    address?: string;
    bloodType?: string;
    allergies?: string;
    emergencyContact?: string;
    alerts?: Array<{
      id: string;
      severity: string;
      message: string;
      resolvedAt?: string;
    }>;
    medications?: unknown[];
    careTeam?: unknown[];
    _count?: { visits?: number; labOrders?: number };
  };
  const patient = patientResponse?.data as PatientDetail | undefined;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-[#028090] rounded-full animate-spin" />
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 bg-white border-b border-slate-100">
        <Link
          href="/patients"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Patients
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#028090]/10 flex items-center justify-center">
              <span className="text-[#028090] text-xl font-bold">
                {patient.fullName.charAt(0)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">
                  {patient.fullName}
                </h1>
                <span
                  className={`badge border ${riskColor(patient.riskLevel)}`}
                >
                  {patient.riskLevel} risk
                </span>
                <span className={`badge ${statusColor(patient.status)}`}>
                  {patient.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {patient.primaryDiagnosis || "No primary diagnosis"}
              </p>
              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                {patient.dateOfBirth && (
                  <span>DOB: {formatDate(patient.dateOfBirth)}</span>
                )}
                {patient.gender && (
                  <span className="capitalize">{patient.gender}</span>
                )}
                {patient.admissionDate && (
                  <span>Admitted: {formatDate(patient.admissionDate)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(patient.alerts?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-600">
                  {patient.alerts?.length ?? 0} alerts
                </span>
              </div>
            )}
            {canIssuePortal && (
              <button
                type="button"
                disabled={!patient.email || issuePortalMutation.isPending}
                title={
                  patient.email
                    ? "Email a single-use patient portal login link"
                    : "Add a patient email before issuing portal access"
                }
                onClick={() => issuePortalMutation.mutate()}
                className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {issuePortalMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                Issue portal link
              </button>
            )}
            <button className="btn-ghost flex items-center gap-2 text-sm">
              <Edit className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
        </div>

        {portalError && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {portalError}
          </p>
        )}
        {portalLink && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
            <Check className="w-4 h-4 text-[#028090]" />
            <span className="text-slate-700">Portal link sent to {patient.email}.</span>
            <a
              href={portalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#028090] font-medium hover:underline truncate max-w-md"
            >
              Copy/open link
            </a>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#028090] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === "alerts" && (patient.alerts?.length ?? 0) > 0 && (
                <span
                  className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {patient.alerts?.length ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === "overview" && <OverviewTab patient={patient} />}
        {activeTab === "clinical" && orgId && (
          <ClinicalTabPanel
            patientId={patientId as string}
            orgId={orgId}
            carePlans={(patient as { carePlans?: unknown[] }).carePlans}
            request={request}
          />
        )}
        {activeTab === "vitals" && (
          <VitalsTab
            vitals={(vitals?.data as unknown[]) || []}
            patientId={patientId as string}
            orgId={orgId}
            request={request}
          />
        )}
        {activeTab === "medications" && (
          <MedicationsTab
            medications={(patient.medications ?? []) as unknown[]}
          />
        )}
        {activeTab === "care_team" && (
          <CareTeamTab
            team={(patient.careTeam ?? []) as unknown[]}
            patientId={patientId as string}
            orgId={orgId!}
            request={request}
          />
        )}
        {activeTab === "alerts" && (
          <AlertsTab
            alerts={
              (patient.alerts ?? []) as Array<{
                id: string;
                severity: string;
                message: string;
                resolvedAt?: string;
              }>
            }
          />
        )}
        {activeTab === "labs" && (
          <LabsTab
            labCount={patient._count?.labOrders as number | undefined}
            patientId={patientId as string}
            orgId={orgId}
          />
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-slate-50 last:border-0">
      <dt className="w-36 text-xs font-medium text-slate-400 uppercase tracking-wide flex-shrink-0">
        {label}
      </dt>
      <dd className="text-sm text-slate-700">
        {value || <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}

function OverviewTab({ patient }: { patient: any }) {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">
            Patient Information
          </h3>
          <dl>
            <InfoRow label="Full Name" value={patient.fullName} />
            <InfoRow
              label="Date of Birth"
              value={
                patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null
              }
            />
            <InfoRow label="Gender" value={patient.gender} />
            <InfoRow label="Blood Type" value={patient.bloodType} />
            <InfoRow label="Insurance" value={patient.insuranceProvider} />
            <InfoRow label="Insurance #" value={patient.insuranceNumber} />
          </dl>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">
            Contact Information
          </h3>
          <dl>
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="Email" value={patient.email} />
            <InfoRow
              label="Address"
              value={[patient.address, patient.city].filter(Boolean).join(", ")}
            />
            <InfoRow label="Emergency" value={patient.emergencyContact} />
            <InfoRow label="Emergency Ph." value={patient.emergencyPhone} />
          </dl>
        </div>
        {patient.allergies?.length > 0 && (
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">
              Allergies
            </h3>
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((a: string, i: number) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium"
                >
                  ⚠ {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">
            Care Settings
          </h3>
          <div className="space-y-2">
            {[
              {
                key: "isHomeCare",
                label: "Home Care",
                color: "bg-blue-50 text-blue-700",
              },
              {
                key: "isHospice",
                label: "Hospice",
                color: "bg-purple-50 text-purple-700",
              },
              {
                key: "isPalliative",
                label: "Palliative",
                color: "bg-rose-50 text-rose-700",
              },
            ].map(
              (s) =>
                patient[s.key] && (
                  <div
                    key={s.key}
                    className={`px-3 py-2 rounded-xl text-sm font-medium ${s.color}`}
                  >
                    ✓ {s.label}
                  </div>
                ),
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">
            Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Visit Logs</span>
              <span className="text-sm font-semibold text-slate-800">
                {patient._count?.visitLogs || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Lab Orders</span>
              <span className="text-sm font-semibold text-slate-800">
                {patient._count?.labOrders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Open Alerts</span>
              <span
                className={`text-sm font-semibold ${patient.alerts?.length > 0 ? "text-red-600" : "text-slate-800"}`}
              >
                {patient.alerts?.length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalsTab({
  vitals,
  patientId,
  orgId,
  request,
}: {
  vitals: any[];
  patientId: string;
  orgId?: string;
  request: any;
}) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const addVital = useMutation({
    mutationFn: (data: any) =>
      request(`/api/orgs/${orgId}/patients/${patientId}/vitals`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vitals"] });
      setShowForm(false);
    },
  });

  const [form, setForm] = useState({
    systolicBp: "",
    diastolicBp: "",
    heartRate: "",
    oxygenSaturation: "",
    temperature: "",
    respiratoryRate: "",
    painScore: "",
    notes: "",
  });

  const latest = vitals[0];

  return (
    <div className="space-y-5">
      {/* Latest vitals summary */}
      {latest && (
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Blood Pressure",
              value:
                latest.systolicBp && latest.diastolicBp
                  ? `${latest.systolicBp}/${latest.diastolicBp}`
                  : "—",
              unit: "mmHg",
              danger: latest.systolicBp > 180,
            },
            {
              label: "Heart Rate",
              value: latest.heartRate || "—",
              unit: "bpm",
              danger: latest.heartRate > 120 || latest.heartRate < 50,
            },
            {
              label: "SpO2",
              value: latest.oxygenSaturation
                ? `${latest.oxygenSaturation}%`
                : "—",
              unit: "",
              danger: latest.oxygenSaturation < 90,
            },
            {
              label: "Temperature",
              value: latest.temperature ? `${latest.temperature}°C` : "—",
              unit: "",
              danger: latest.temperature > 38.5,
            },
          ].map((v) => (
            <div
              key={v.label}
              className={`card p-4 ${v.danger ? "border-red-200 bg-red-50/30" : ""}`}
            >
              <p className="text-xs text-slate-400 font-medium">{v.label}</p>
              <p
                className={`text-2xl font-bold mt-1 ${v.danger ? "text-red-600" : "text-slate-900"}`}
              >
                {v.value}
              </p>
              {v.unit && <p className="text-xs text-slate-400">{v.unit}</p>}
              {v.danger && (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  ⚠ Abnormal
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Vital History</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <Activity className="w-3.5 h-3.5" />
          Record Vitals
        </button>
      </div>

      {showForm && (
        <div className="card p-5">
          <h4 className="font-medium text-slate-800 mb-4 text-sm">
            New Vital Reading
          </h4>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "systolicBp", label: "Systolic BP", placeholder: "120" },
              { key: "diastolicBp", label: "Diastolic BP", placeholder: "80" },
              { key: "heartRate", label: "Heart Rate", placeholder: "72" },
              { key: "oxygenSaturation", label: "SpO2 (%)", placeholder: "98" },
              { key: "temperature", label: "Temp (°C)", placeholder: "37.0" },
              {
                key: "respiratoryRate",
                label: "Resp. Rate",
                placeholder: "16",
              },
              {
                key: "painScore",
                label: "Pain Score (0-10)",
                placeholder: "0",
              },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {f.label}
                </label>
                <input
                  type="number"
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="input-base text-sm"
                />
              </div>
            ))}
            <div className="col-span-3">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="input-base text-sm resize-none h-16"
                placeholder="Additional observations..."
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                addVital.mutate(
                  Object.fromEntries(
                    Object.entries(form)
                      .filter(([, v]) => v !== "")
                      .map(([k, v]) => [k, k === "notes" ? v : Number(v)]),
                  ),
                )
              }
              disabled={addVital.isPending}
              className="btn-primary text-sm"
            >
              {addVital.isPending ? "Saving..." : "Save Reading"}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                BP
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                HR
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                SpO2
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                Temp
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                Recorded By
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {vitals.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-sm text-slate-400"
                >
                  No vital readings recorded yet
                </td>
              </tr>
            )}
            {vitals.map((v: any) => (
              <tr key={v.id} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 text-sm text-slate-600">
                  {formatRelative(v.recordedAt)}
                </td>
                <td className="px-4 py-3">
                  {v.systolicBp && v.diastolicBp ? (
                    <span
                      className={`text-sm font-medium ${v.systolicBp > 180 ? "text-red-600" : "text-slate-700"}`}
                    >
                      {v.systolicBp}/{v.diastolicBp}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {v.heartRate || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {v.oxygenSaturation ? (
                    `${v.oxygenSaturation}%`
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {v.temperature ? (
                    `${v.temperature}°C`
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {v.recordedBy?.fullName || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MedicationsTab({ medications }: { medications: any[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Active Medications</h3>
        <button className="btn-primary text-sm flex items-center gap-2">
          <Pill className="w-3.5 h-3.5" /> Add Medication
        </button>
      </div>
      {medications.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          <Pill className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No medications recorded
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {medications.map((m: any) => (
            <div key={m.id} className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    {m.name}
                  </p>
                  {m.genericName && (
                    <p className="text-xs text-slate-400">{m.genericName}</p>
                  )}
                </div>
                <span className="badge bg-emerald-50 text-emerald-700 text-xs">
                  Active
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-slate-500">
                {m.dosage && <span>💊 {m.dosage}</span>}
                {m.frequency && <span>🕐 {m.frequency}</span>}
                {m.route && <span>📍 {m.route}</span>}
              </div>
              {m.instructions && (
                <p className="mt-1.5 text-xs text-slate-400 italic">
                  {m.instructions}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CareTeamTab({
  team,
  patientId,
  orgId,
  request,
}: {
  team: any[];
  patientId: string;
  orgId: string;
  request: ReturnType<typeof useApi>["request"];
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("primary_nurse");
  const [error, setError] = useState("");

  const { data: membersData } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => request(`/api/orgs/${orgId}/members`),
    enabled: !!orgId,
  });

  const members = (membersData?.data as Array<{ id: string; fullName: string }>) || [];

  const assignMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/${orgId}/patients/${patientId}/care-team`, {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", orgId, patientId] });
      setUserId("");
      setError("");
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (removeUserId: string) =>
      request(`/api/orgs/${orgId}/patients/${patientId}/care-team`, {
        method: "DELETE",
        body: JSON.stringify({ userId: removeUserId }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["patient", orgId, patientId] }),
  });

  const active = team.filter((m: any) => m.isActive);

  return (
    <div className="space-y-6">
      <form
        className="card p-4 flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          assignMutation.mutate();
        }}
      >
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-500">Staff member</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            required
          >
            <option value="">Select...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Role</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm w-40"
            required
          />
        </div>
        <button
          type="submit"
          disabled={assignMutation.isPending}
          className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
        >
          Assign
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-3 gap-4">
        {active.map((m: any) => (
          <div key={m.userId} className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#028090]/10 flex items-center justify-center">
                <span className="text-[#028090] font-bold text-sm">
                  {m.user?.fullName?.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {m.user?.fullName}
                </p>
                <p className="text-xs text-slate-400 capitalize">
                  {m.role?.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeMutation.mutate(m.userId)}
              className="mt-3 text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        {active.length === 0 && (
          <div className="col-span-3 text-center py-8 text-slate-400 text-sm">
            No care team members assigned
          </div>
        )}
      </div>
    </div>
  );
}

function AlertsTab({ alerts }: { alerts: any[] }) {
  return (
    <div className="space-y-3">
      {alerts.length === 0 && (
        <div className="card p-8 text-center text-slate-400 text-sm">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          No active alerts — patient is stable
        </div>
      )}
      {alerts.map((a: any) => (
        <div
          key={a.id}
          className={`card p-4 border-l-4 ${
            a.severity === "critical"
              ? "border-l-red-500"
              : a.severity === "warning"
                ? "border-l-amber-500"
                : "border-l-blue-500"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.body}</p>
            </div>
            <span
              className={`badge text-xs ${
                a.severity === "critical"
                  ? "bg-red-100 text-red-700"
                  : a.severity === "warning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
              }`}
            >
              {a.severity}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {formatRelative(a.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function LabsTab({
  labCount,
  patientId,
  orgId,
}: {
  labCount?: number;
  patientId: string;
  orgId?: string;
}) {
  return (
    <div className="card p-8 text-center text-slate-400">
      <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{labCount || 0} lab orders on record</p>
      <button className="mt-4 btn-primary text-sm">Order Lab Panel</button>
    </div>
  );
}
