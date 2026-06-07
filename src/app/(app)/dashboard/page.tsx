"use client";
import { useAuth } from "@/hooks/useAuth";
import { useOrgApi } from "@/hooks/useOrgApi";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  ClipboardList,
  Activity,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { formatRelative, riskColor, statusColor } from "@/lib/utils";
import Link from "next/link";

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  trend?: string;
  color: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1.5 text-3xl font-bold text-slate-900">{value}</p>
          {trend && <p className="mt-1 text-xs text-slate-500">{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, activeOrg, activeBranchId } = useAuth();
  const { client, orgId } = useOrgApi();

  const { data: summary } = useQuery({
    queryKey: ["dashboard", orgId, "summary", activeBranchId],
    queryFn: () => client!.dashboard.summary({ branchId: activeBranchId ?? undefined }),
    enabled: !!client,
  });

  const { data: patientsResult } = useQuery({
    queryKey: ["patients", orgId, "recent", activeBranchId],
    queryFn: () => client!.patients.listPaginated({ pageSize: 5 }),
    enabled: !!client,
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", orgId, "recent", activeBranchId],
    queryFn: () =>
      client!.tasks.list({
        pageSize: 5,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    enabled: !!client,
  });
  const patients = patientsResult?.items ?? [];
  const taskItems = tasks ?? [];
  const totalPatients = summary?.totalPatients ?? 0;
  const highRisk = summary?.highRiskPatients ?? 0;
  const openTasks = summary?.openTasks ?? 0;
  const unresolvedAlerts = summary?.unresolvedAlerts ?? 0;
  const complianceItems = summary?.compliance?.openComplianceItems ?? 0;
  const criticalAlerts = summary?.compliance?.openCriticalAlerts ?? 0;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}, {user?.fullName?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-slate-500 text-sm">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {activeOrg && (
            <span className="ml-2 text-[#028090]">· {activeOrg.org.name}</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={totalPatients}
          trend="Active caseload"
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="High Risk"
          value={highRisk}
          trend="Require attention"
          color="bg-red-50 text-red-600"
        />
        <StatCard
          icon={ClipboardList}
          label="Open Tasks"
          value={openTasks}
          trend="Org-wide open"
          color="bg-amber-50 text-amber-600"
        />
        <Link href="/alerts" className="block hover:opacity-95 transition-opacity">
          <StatCard
            icon={Activity}
            label="Alerts"
            value={unresolvedAlerts}
            trend="Unresolved clinical alerts"
            color="bg-emerald-50 text-emerald-600"
          />
        </Link>
        <Link href="/compliance" className="block hover:opacity-95 transition-opacity">
          <StatCard
            icon={ShieldAlert}
            label="Compliance"
            value={complianceItems}
            trend={
              criticalAlerts > 0
                ? `${criticalAlerts} critical alert${criticalAlerts === 1 ? "" : "s"}`
                : "Open compliance items"
            }
            color="bg-violet-50 text-violet-600"
          />
        </Link>
      </div>

      {summary && (
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 -mt-4">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#028090]" />
            {summary.visitsToday} visits today
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            {summary.pendingVisitReviews} pending reviews
          </span>
          {summary.missedVisitsToday > 0 && (
            <span className="flex items-center gap-1.5 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              {summary.missedVisitsToday} missed today
            </span>
          )}
          {summary.compliance && summary.compliance.openEscalations > 0 && (
            <span className="flex items-center gap-1.5 text-violet-700">
              <ShieldAlert className="w-4 h-4" />
              {summary.compliance.openEscalations} open escalations
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Recent Patients</h2>
            <Link
              href="/patients"
              className="text-xs text-[#028090] hover:underline font-medium"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {patients.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No patients yet. Add your first patient to get started.</p>
              </div>
            )}
            {patients.map((p: any) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#028090]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#028090] text-sm font-bold">
                    {p.fullName.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {p.fullName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {p.primaryDiagnosis || "No diagnosis"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`badge border ${riskColor(p.riskLevel)} text-[10px]`}
                  >
                    {p.riskLevel}
                  </span>
                  <span
                    className={`badge ${statusColor(p.status)} text-[10px]`}
                  >
                    {p.status}
                  </span>
                </div>
                {(p._count?.alerts || 0) > 0 && (
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[9px] font-bold">
                      {p._count.alerts}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Recent Tasks</h2>
            <Link
              href="/tasks"
              className="text-xs text-[#028090] hover:underline font-medium"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {taskItems.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">
                <ClipboardList className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p>No tasks yet</p>
              </div>
            )}
            {taskItems.slice(0, 5).map((t: any) => (
              <div key={t.id} className="p-4">
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      t.priority === "urgent"
                        ? "bg-red-500"
                        : t.priority === "high"
                          ? "bg-orange-500"
                          : t.priority === "medium"
                            ? "bg-amber-500"
                            : "bg-slate-300"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 line-clamp-2">
                      {t.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatRelative(t.createdAt)}
                      {t.column && <span> · {t.column.name}</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            href: "/patients/new",
            icon: Users,
            label: "Admit Patient",
            color: "bg-blue-50 hover:bg-blue-100 text-blue-700",
          },
          {
            href: "/tasks/new",
            icon: ClipboardList,
            label: "Create Task",
            color: "bg-amber-50 hover:bg-amber-100 text-amber-700",
          },
          {
            href: "/schedule",
            icon: Calendar,
            label: "View Schedule",
            color: "bg-green-50 hover:bg-green-100 text-green-700",
          },
          {
            href: "/reports",
            icon: TrendingUp,
            label: "View Reports",
            color: "bg-purple-50 hover:bg-purple-100 text-purple-700",
          },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`flex items-center gap-3 p-4 rounded-2xl border border-transparent transition-all ${action.color}`}
          >
            <action.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
