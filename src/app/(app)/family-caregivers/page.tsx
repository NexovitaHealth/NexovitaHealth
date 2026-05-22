"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import {
  CheckCircle2,
  Link2,
  Loader2,
  UserPlus,
  XCircle,
  Ban,
} from "lucide-react";

type FamilyAccount = {
  id: string;
  status: string;
  relationship: string;
  patient: { id: string; fullName: string };
  user: { email: string; fullName: string };
  canViewSchedule: boolean;
  canViewCarePlan: boolean;
  canViewVitals: boolean;
};

export default function FamilyCaregiversPage() {
  const { request, orgId } = useApi();
  const { user, activeOrg } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    email: "",
    fullName: "",
    relationship: "",
  });
  const [message, setMessage] = useState("");

  const canManage =
    ["owner", "admin"].includes(activeOrg?.role || "") ||
    ["agency_admin", "supervisor", "superadmin"].includes(user?.role || "");

  const { data, isLoading } = useQuery({
    queryKey: ["family-caregivers", orgId],
    queryFn: () =>
      request<FamilyAccount[]>("/api/orgs/{orgId}/family-caregivers"),
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      request("/api/orgs/{orgId}/family-caregivers", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-caregivers", orgId] });
      setShowForm(false);
      setForm({ patientId: "", email: "", fullName: "", relationship: "" });
      setMessage("Caregiver request created and pending approval.");
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      accountId,
      action,
    }: {
      accountId: string;
      action: "approve" | "reject" | "revoke" | "portal-access";
    }) =>
      request(`/api/orgs/{orgId}/family-caregivers/${accountId}/${action}`, {
        method: action === "portal-access" ? "POST" : "PATCH",
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["family-caregivers", orgId] });
      if ((res.data as { portalUrl?: string })?.portalUrl) {
        setMessage("Portal link issued and emailed to the caregiver.");
      } else {
        setMessage("Caregiver record updated.");
      }
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const accounts = (data?.data as FamilyAccount[]) || [];

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Family caregivers</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review pending access requests and issue portal login links after approval.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#028090] text-white text-sm font-semibold"
          >
            <UserPlus className="w-4 h-4" />
            Add caregiver
          </button>
        )}
      </div>

      {message && (
        <p className="mb-4 text-sm text-slate-700 bg-slate-100 rounded-lg px-4 py-2">
          {message}
        </p>
      )}

      {showForm && (
        <form
          className="mb-6 bg-white border border-slate-100 rounded-2xl p-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Patient ID (UUID)"
            value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            required
          />
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Caregiver full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            type="email"
            placeholder="Caregiver email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Relationship (e.g. daughter, spouse)"
            value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm"
            >
              Submit request
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-slate-500">No pending caregiver requests.</p>
      ) : (
        <ul className="space-y-4">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-slate-900">{account.user.fullName}</p>
                <p className="text-sm text-slate-500">{account.user.email}</p>
                <p className="text-sm text-slate-600 mt-1">
                  Patient: {account.patient.fullName} · {account.relationship}
                </p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      actionMutation.mutate({ accountId: account.id, action: "approve" })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      actionMutation.mutate({ accountId: account.id, action: "reject" })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  {account.status === "approved" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          actionMutation.mutate({
                            accountId: account.id,
                            action: "portal-access",
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#028090]/10 text-[#028090] text-sm"
                      >
                        <Link2 className="w-4 h-4" />
                        Send portal link
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          actionMutation.mutate({ accountId: account.id, action: "revoke" })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm"
                      >
                        <Ban className="w-4 h-4" />
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
