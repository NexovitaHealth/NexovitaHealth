"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Building2,
  Users,
  Activity,
  MapPin,
  Mail,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  Send,
  Copy,
  Check,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type DashboardData = {
  totalAgencies: number;
  activeAgencies: number;
  newAgenciesThisMonth: number;
  totalStaff: number;
  totalPatients: number;
  totalBranches: number;
  pendingInvitations: number;
  recentAgencies: Array<{
    id: string;
    name: string;
    slug: string;
    city: string | null;
    region: string | null;
    isActive: boolean;
    createdAt: string;
    _count: { members: number; branches: number; patients: number };
  }>;
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  href?: string;
}) {
  const inner = (
    <div className="card p-5 h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-3xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link> : inner;
}

function SendAgencyInviteCard() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError("");
    setSending(true);
    try {
      const res = await fetch("/api/admin/agency-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send invite");
      setSentUrl(json.data.setupUrl);
      setEmail("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const copyUrl = () => {
    if (!sentUrl) return;
    navigator.clipboard.writeText(sentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold text-slate-800 mb-4">Send Agency Invite</h2>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <p className="text-sm text-slate-500 mb-4">
          Send a setup link to someone who will create and manage their own agency.
        </p>

        {sentUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Invite sent! Share the link below if email delivery is delayed.</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={sentUrl}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 bg-slate-50 font-mono truncate"
              />
              <button
                type="button"
                onClick={copyUrl}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSentUrl(null)}
              className="text-xs text-[#028090] hover:underline font-medium"
            >
              Send another invite
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-start gap-3">
            <div className="flex-1">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="agency-admin@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
              />
              {sendError && (
                <p className="text-xs text-red-600 mt-1.5">{sendError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#028090] text-white text-sm font-medium hover:bg-[#026f7c] disabled:opacity-60 transition-colors flex-shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending…" : "Send invite"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      const { data } = await res.json();
      return data;
    },
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}, {user?.fullName?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Platform overview — all agencies</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      ) : data ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <StatCard
              icon={Building2}
              label="Total Agencies"
              value={data.totalAgencies}
              sub={`${data.activeAgencies} active · ${data.totalAgencies - data.activeAgencies} inactive`}
              color="bg-blue-50 text-blue-600"
              href="/admin/agencies"
            />
            <StatCard
              icon={Users}
              label="Total Staff"
              value={data.totalStaff}
              sub="Across all agencies"
              color="bg-violet-50 text-violet-600"
            />
            <StatCard
              icon={Activity}
              label="Total Patients"
              value={data.totalPatients}
              sub="Platform-wide"
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={MapPin}
              label="Locations"
              value={data.totalBranches}
              sub="Active branches"
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-5 max-w-sm">
            <StatCard
              icon={TrendingUp}
              label="New This Month"
              value={data.newAgenciesThisMonth}
              sub="Agencies created"
              color="bg-sky-50 text-sky-600"
            />
            <StatCard
              icon={Mail}
              label="Pending Invites"
              value={data.pendingInvitations}
              sub="Awaiting registration"
              color="bg-rose-50 text-rose-600"
            />
          </div>

          {/* Recent Agencies */}
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Recent Agencies</h2>
              <Link href="/admin/agencies" className="text-xs text-[#028090] hover:underline font-medium">
                View all
              </Link>
            </div>

            {data.recentAgencies.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No agencies yet.</p>
                <Link href="/admin/agencies" className="text-sm text-[#028090] mt-3 inline-block font-medium hover:underline">
                  Create the first agency
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {data.recentAgencies.map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/agencies/${a.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#028090]/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-[#028090]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm text-slate-800 truncate">{a.name}</p>
                        {a.isActive
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {[a.city, a.region].filter(Boolean).join(", ") || "No location"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{a._count.members}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a._count.branches}</span>
                      <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{a._count.patients}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="max-w-2xl">
            <h2 className="font-semibold text-slate-800 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/admin/agencies"
                className="flex items-center gap-3 p-4 rounded-2xl border border-transparent bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
              >
                <Building2 className="w-5 h-5" />
                <span className="text-sm font-medium">Manage Agencies</span>
              </Link>
              <Link
                href="/admin/agencies"
                onClick={(e) => { e.preventDefault(); window.location.href = "/admin/agencies?new=1"; }}
                className="flex items-center gap-3 p-4 rounded-2xl border border-transparent bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
              >
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-medium">New Agency</span>
              </Link>
            </div>
          </div>

          <SendAgencyInviteCard />
        </>
      ) : null}
    </div>
  );
}
