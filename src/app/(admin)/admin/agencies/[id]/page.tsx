"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft, Building2, MapPin, Users, Plus, Loader2,
  Pencil, Trash2, CheckCircle2, XCircle, ChevronDown, Mail, Copy, Check,
} from "lucide-react";
import { ROLE_LABELS, ORG_ROLE_LABELS } from "@/lib/permissions";

// ---- types ----
type Branch = { id: string; name: string; address: string | null; city: string | null; region: string | null; phone: string | null; isActive: boolean; _count?: { patients: number } };
type MemberUser = { id: string; email: string; fullName: string; role: string; avatarUrl: string | null; isActive: boolean };
type Member = { id: string; role: string; joinedAt: string; user: MemberUser };
type Agency = {
  id: string; name: string; slug: string; email: string | null; phone: string | null;
  address: string | null; city: string | null; region: string | null; country: string;
  isActive: boolean; subscriptionTier: string;
  _count: { members: number; branches: number; patients: number };
  branches: Branch[]; members: Member[];
};

type Tab = "overview" | "locations" | "staff";

const USER_ROLES = [
  { value: "agency_admin", label: "Agency Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "physician", label: "Physician" },
  { value: "physician_independent", label: "Independent Physician" },
  { value: "aide", label: "Home Aide" },
  { value: "billing_manager", label: "Billing Manager" },
  { value: "school_nurse", label: "School Nurse" },
];
const ORG_ROLES = ["owner", "admin", "member", "guest"] as const;

// ---- api helpers ----
async function fetchAgency(id: string): Promise<Agency> {
  const res = await fetch(`/api/admin/agencies/${id}`);
  if (!res.ok) throw new Error("Agency not found");
  const { data } = await res.json();
  return data;
}

export default function AgencyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: agency, isLoading } = useQuery({ queryKey: ["admin", "agency", id], queryFn: () => fetchAgency(id) });

  // ---- overview edit state ----
  const [editInfo, setEditInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: "", email: "", phone: "", address: "", city: "", region: "" });

  // ---- branch state ----
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: "", address: "", city: "", region: "", phone: "" });
  const [branchError, setBranchError] = useState<string | null>(null);

  // ---- staff state ----
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ email: "", fullName: "", password: "", userRole: "aide", orgRole: "member" });
  const [staffError, setStaffError] = useState<string | null>(null);

  // ---- invite state ----
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", orgRole: "member" });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ inviteUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // ---- mutations ----
  const updateAgency = useMutation({
    mutationFn: (body: object) => fetch(`/api/admin/agencies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "agency", id] }); setEditInfo(false); },
  });

  const createBranch = useMutation({
    mutationFn: (body: object) => fetch(`/api/admin/agencies/${id}/branches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "agency", id] }); setAddingBranch(false); setBranchForm({ name: "", address: "", city: "", region: "", phone: "" }); setBranchError(null); },
    onError: (e: Error) => setBranchError(e.message),
  });

  const toggleBranch = useMutation({
    mutationFn: ({ branchId, isActive }: { branchId: string; isActive: boolean }) =>
      fetch(`/api/admin/agencies/${id}/branches/${branchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "agency", id] }),
  });

  const addMember = useMutation({
    mutationFn: (body: object) => fetch(`/api/admin/agencies/${id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "agency", id] }); setAddingStaff(false); setStaffForm({ email: "", fullName: "", password: "", userRole: "aide", orgRole: "member" }); setStaffError(null); },
    onError: (e: Error) => setStaffError(e.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => fetch(`/api/admin/agencies/${id}/members/${userId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "agency", id] }),
  });

  const sendInvite = useMutation({
    mutationFn: (body: { email: string; orgRole: string }) =>
      fetch(`/api/admin/agencies/${id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j.data; }),
    onSuccess: (data) => {
      setInviteResult(data);
      setInviteError(null);
    },
    onError: (e: Error) => setInviteError(e.message),
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ userId, orgRole }: { userId: string; orgRole: string }) =>
      fetch(`/api/admin/agencies/${id}/members/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgRole }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "agency", id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }
  if (!agency) return <div className="p-8 text-slate-500">Agency not found.</div>;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/agencies" className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 truncate">{agency.name}</h1>
            {agency.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          </div>
          <p className="text-sm text-slate-500">/{agency.slug}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{agency._count.members} staff</span>
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{agency._count.branches} locations</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-0">
        {(["overview", "locations", "staff"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              tab === t ? "border-[#028090] text-[#028090]" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 max-w-xl">
          {!editInfo ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Name", agency.name], ["Slug", `/${agency.slug}`],
                  ["Email", agency.email || "—"], ["Phone", agency.phone || "—"],
                  ["Address", agency.address || "—"], ["City", agency.city || "—"],
                  ["Region", agency.region || "—"], ["Country", agency.country],
                  ["Subscription", agency.subscriptionTier], ["Status", agency.isActive ? "Active" : "Inactive"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <p className="text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setInfoForm({ name: agency.name, email: agency.email || "", phone: agency.phone || "", address: agency.address || "", city: agency.city || "", region: agency.region || "" }); setEditInfo(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => { if (confirm(`${agency.isActive ? "Deactivate" : "Activate"} ${agency.name}?`)) updateAgency.mutate({ isActive: !agency.isActive }); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${agency.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}
                >
                  {agency.isActive ? <><XCircle className="w-4 h-4" /> Deactivate</> : <><CheckCircle2 className="w-4 h-4" /> Activate</>}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); updateAgency.mutate(infoForm); }} className="space-y-4">
              {[
                { label: "Name *", key: "name", placeholder: "Sunrise Health Agency" },
                { label: "Email", key: "email", placeholder: "admin@agency.com" },
                { label: "Phone", key: "phone", placeholder: "+1-555-0100" },
                { label: "Address", key: "address", placeholder: "123 Main St" },
                { label: "City", key: "city", placeholder: "Los Angeles" },
                { label: "Region / State", key: "region", placeholder: "CA" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input
                    className="input w-full"
                    value={(infoForm as any)[key]}
                    onChange={(e) => setInfoForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditInfo(false)} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={updateAgency.isPending} className="flex-1 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                  {updateAgency.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* LOCATIONS TAB */}
      {tab === "locations" && (
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">{agency.branches.length} location{agency.branches.length !== 1 ? "s" : ""}</p>
            <button
              onClick={() => { setAddingBranch(true); setBranchError(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium hover:bg-[#026e7d]"
            >
              <Plus className="w-4 h-4" /> Add Location
            </button>
          </div>

          {agency.branches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No locations yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {agency.branches.map((b) => (
                <div key={b.id} className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm text-slate-800 truncate">{b.name}</p>
                      {b.isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{[b.city, b.region].filter(Boolean).join(", ") || "No location"}</p>
                  </div>
                  <button
                    onClick={() => { if (confirm(`${b.isActive ? "Deactivate" : "Activate"} ${b.name}?`)) toggleBranch.mutate({ branchId: b.id, isActive: !b.isActive }); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${b.isActive ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                  >
                    {b.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Branch Modal */}
          {addingBranch && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Add Location</h2>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); createBranch.mutate(branchForm); }} className="p-6 space-y-4">
                  {branchError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{branchError}</p>}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Location Name *</label>
                    <input className="input w-full" value={branchForm.name} onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))} placeholder="Main Office" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                    <input className="input w-full" value={branchForm.address} onChange={(e) => setBranchForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                      <input className="input w-full" value={branchForm.city} onChange={(e) => setBranchForm((f) => ({ ...f, city: e.target.value }))} placeholder="Los Angeles" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Region</label>
                      <input className="input w-full" value={branchForm.region} onChange={(e) => setBranchForm((f) => ({ ...f, region: e.target.value }))} placeholder="CA" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input className="input w-full" value={branchForm.phone} onChange={(e) => setBranchForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1-555-0100" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { setAddingBranch(false); setBranchError(null); }} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={createBranch.isPending} className="flex-1 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                      {createBranch.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add Location
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STAFF TAB */}
      {tab === "staff" && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">{agency.members.length} staff member{agency.members.length !== 1 ? "s" : ""}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSendingInvite(true); setInviteError(null); setInviteResult(null); setCopied(false); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#028090] text-[#028090] text-sm font-medium hover:bg-[#028090]/5"
              >
                <Mail className="w-4 h-4" /> Send Invite
              </button>
              <button
                onClick={() => { setAddingStaff(true); setStaffError(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium hover:bg-[#026e7d]"
              >
                <Plus className="w-4 h-4" /> Add Staff
              </button>
            </div>
          </div>

          {agency.members.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No staff yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {agency.members.map((m) => (
                <div key={m.id} className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-full bg-[#028090]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#028090] text-sm font-bold">{m.user.fullName.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{m.user.fullName}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="badge bg-slate-100 text-slate-600 text-[10px]">
                      {ROLE_LABELS[m.user.role] || m.user.role}
                    </span>
                    {/* Org role selector */}
                    <div className="relative">
                      <select
                        value={m.role}
                        onChange={(e) => updateMemberRole.mutate({ userId: m.user.id, orgRole: e.target.value })}
                        className="appearance-none pl-2 pr-6 py-1 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/30 cursor-pointer"
                      >
                        {ORG_ROLES.map((r) => (
                          <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => { if (confirm(`Remove ${m.user.fullName} from this agency?`)) removeMember.mutate(m.user.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Send Invite Modal */}
          {sendingInvite && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Send Registration Invite</h2>
                  <p className="text-xs text-slate-500 mt-0.5">An email with a registration link will be sent. The recipient sets their own password.</p>
                </div>

                {inviteResult ? (
                  <div className="p-6 space-y-4">
                    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Invite sent successfully</p>
                        <p className="text-xs text-emerald-700 mt-0.5">The registration link was emailed. You can also copy it below.</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Registration link</label>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={inviteResult.inviteUrl}
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-mono truncate"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inviteResult.inviteUrl);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="flex-shrink-0 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => { setSendingInvite(false); setInviteResult(null); setInviteForm({ email: "", orgRole: "member" }); }}
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => { setInviteResult(null); setInviteError(null); setCopied(false); }}
                        className="flex-1 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium hover:bg-[#026e7d]"
                      >
                        Send Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); sendInvite.mutate({ email: inviteForm.email, orgRole: inviteForm.orgRole }); }}
                    className="p-6 space-y-4"
                  >
                    {inviteError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{inviteError}</p>}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email address *</label>
                      <input
                        type="email"
                        required
                        className="input w-full"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="admin@agency.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Org Role *</label>
                      <select
                        className="input w-full"
                        value={inviteForm.orgRole}
                        onChange={(e) => setInviteForm((f) => ({ ...f, orgRole: e.target.value }))}
                      >
                        {ORG_ROLES.map((r) => (
                          <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                        {inviteForm.orgRole === "owner" || inviteForm.orgRole === "admin"
                          ? "Clinical role: Agency Admin"
                          : "Clinical role: Home Aide (can be changed after joining)"}
                      </p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { setSendingInvite(false); setInviteError(null); }}
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={sendInvite.isPending}
                        className="flex-1 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {sendInvite.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Send Invite
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Add Staff Modal */}
          {addingStaff && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Add Staff Member</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Creates a new user account and adds them to this agency.</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); addMember.mutate(staffForm); }} className="p-6 space-y-4">
                  {staffError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{staffError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                      <input className="input w-full" value={staffForm.fullName} onChange={(e) => setStaffForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Sarah Johnson" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                      <input className="input w-full" type="email" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} placeholder="sarah@agency.com" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
                      <input className="input w-full" type="password" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Clinical Role *</label>
                      <select className="input w-full" value={staffForm.userRole} onChange={(e) => setStaffForm((f) => ({ ...f, userRole: e.target.value }))}>
                        {USER_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Org Role *</label>
                      <select className="input w-full" value={staffForm.orgRole} onChange={(e) => setStaffForm((f) => ({ ...f, orgRole: e.target.value }))}>
                        {ORG_ROLES.map((r) => <option key={r} value={r}>{ORG_ROLE_LABELS[r]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => { setAddingStaff(false); setStaffError(null); }} className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="submit" disabled={addMember.isPending} className="flex-1 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                      {addMember.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add Staff
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
