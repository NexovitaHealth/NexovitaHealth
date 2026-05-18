"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { getInitials, formatDate } from "@/lib/utils";
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  guest: "Guest",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  member: "bg-slate-100 text-slate-600",
  guest: "bg-slate-50 text-slate-400",
};

type Member = {
  userId: string;
  orgRole: string;
  role: string;
  joinedAt: string;
  isPrimary: boolean;
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
};

export default function TeamPage() {
  const { request, orgId } = useApi();
  const { user, activeOrg } = useAuth();
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "member" });
  const [removeId, setRemoveId] = useState<string | null>(null);

  const isAdmin = ["owner", "admin"].includes(activeOrg?.role || "");

  const { data: membersData, isLoading } = useQuery({
    queryKey: ["members", orgId],
    queryFn: () => request("/api/orgs/{orgId}/members"),
    enabled: !!orgId,
  });

  const { data: invitesData } = useQuery({
    queryKey: ["invites", orgId],
    queryFn: () => request("/api/orgs/{orgId}/invite"),
    enabled: !!orgId && isAdmin,
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      request("/api/orgs/{orgId}/invite", {
        method: "POST",
        body: JSON.stringify(inviteForm),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      setShowInvite(false);
      setInviteForm({ email: "", role: "member" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      request("/api/orgs/{orgId}/members", {
        method: "DELETE",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      setRemoveId(null);
    },
  });

  const members = (membersData?.data ?? []) as Member[];
  const pendingInvites = (invitesData?.data ?? []) as PendingInvite[];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#028090]" /> Team
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {members.length} members in {activeOrg?.org.name}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-[#028090] hover:bg-[#026f7c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
        )}
      </div>

      {/* Members table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">
            Active Members ({members.length})
          </h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#028090] to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {getInitials(m.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {m.fullName}
                    </p>
                    {m.id === user?.id && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3" /> {m.email}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_COLORS[m.orgRole] || "bg-slate-100 text-slate-600"}`}
                >
                  {ROLE_LABELS[m.orgRole] || m.orgRole}
                </span>
                <p className="text-xs text-slate-400 hidden sm:block w-28 text-right">
                  Joined {formatDate(m.joinedAt)}
                </p>
                {isAdmin && m.id !== user?.id && (
                  <button
                    onClick={() => setRemoveId(m.userId)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1.5 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {isAdmin && pendingInvites.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-amber-50/50">
            <h2 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pending Invitations (
              {pendingInvites.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {inv.email}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Invited {formatDate(inv.createdAt)} · Expires{" "}
                    {formatDate(inv.expiresAt)}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ROLE_COLORS[inv.role] || "bg-slate-100 text-slate-600"}`}
                >
                  {ROLE_LABELS[inv.role] || inv.role}
                </span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-medium">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Invite Team Member
              </h2>
              <button
                onClick={() => setShowInvite(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {inviteMutation.error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {(inviteMutation.error as Error).message}
                </div>
              )}
              {inviteMutation.isSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Invitation sent successfully!
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((p) => ({ ...p, email: e.target.value }))
                  }
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
                  placeholder="colleague@agency.com"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Role
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((p) => ({ ...p, role: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
                >
                  {Object.entries(ROLE_LABELS)
                    .filter(([k]) => k !== "owner")
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
                An email with an invitation link will be sent. The link expires
                in 7 days.
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => setShowInvite(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteForm.email || inviteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-[#028090] hover:bg-[#026f7c] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" /> Send Invite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirm */}
      {removeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Remove member?
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              This person will lose access to the organization immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => removeMutation.mutate(removeId)}
                disabled={removeMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {removeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Remove"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
