"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/utils";
import { ComplianceTrendCharts } from "@/components/compliance/ComplianceTrendCharts";
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  FileWarning,
  ClipboardCheck,
  CreditCard,
  Activity,
  CalendarX,
  Users,
} from "lucide-react";

type ComplianceDashboard = {
  counts: {
    openComplianceItems: number;
    openClinicalAlerts: number;
    openCriticalAlerts: number;
    openWarningAlerts: number;
    openEscalations: number;
    openIncidents: number;
    pendingVisitReviews: number;
    missedVisitsToday: number;
    expiringAuthorisations: number;
    highRiskActivePatients: number;
  };
  alertSeverityCounts: {
    critical: number;
    warning: number;
    info: number;
  };
  expiringAuthorisations: Array<{
    id: string;
    payerName: string;
    authorisationNumber: string;
    endDate: string;
    unitsAuthorised: number;
    unitsUsed: number;
    patient: { id: string; fullName: string };
  }>;
  recentClinicalAlerts: Array<{
    id: string;
    title: string;
    severity: string;
    alertType: string;
    createdAt: string;
    patient: { id: string; fullName: string };
  }>;
  recentEscalations: Array<{
    id: string;
    title: string;
    severity: string;
    patient: { id: string; fullName: string };
  }>;
  recentIncidents: Array<{
    id: string;
    incidentType: string;
    severity: string;
    patient: { id: string; fullName: string };
  }>;
  trends: {
    days: number;
    from: string;
    to: string;
    alerts: Array<{ date: string; count: number }>;
    escalations: Array<{ date: string; count: number }>;
    incidents: Array<{ date: string; count: number }>;
    visitReviews: Array<{ date: string; count: number }>;
    missedVisits: Array<{ date: string; count: number }>;
  };
};

export default function ComplianceDashboardPage() {
  const { request, orgId } = useApi();
  const { can } = usePermissions();
  const [trendDays, setTrendDays] = useState(14);

  const { data, isLoading } = useQuery({
    queryKey: ["compliance-dashboard", orgId, trendDays],
    queryFn: () =>
      request<ComplianceDashboard>(
        `/api/orgs/{orgId}/compliance/dashboard?trendDays=${trendDays}`,
      ),
    enabled: !!orgId && can("compliance:read"),
  });

  const dash = data?.data as ComplianceDashboard | undefined;

  if (!can("compliance:read")) {
    return (
      <div className="p-8 text-sm text-slate-500">
        You do not have access to the compliance dashboard.
      </div>
    );
  }

  if (isLoading || !dash) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
      </div>
    );
  }

  const { counts, alertSeverityCounts } = dash;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#028090]" />
          Compliance dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Org-wide view of clinical alerts, escalations, incidents, visit compliance, and
          authorisation risk.
        </p>
      </div>

      <div className="card p-5 bg-slate-50 border-slate-200">
        <p className="text-sm text-slate-600">Open compliance items</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">
          {counts.openComplianceItems}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Sum of unresolved alerts, open escalations/incidents, pending visit reviews, and
          missed visits today.
        </p>
      </div>

      {dash.trends && (
        <ComplianceTrendCharts
          trends={dash.trends}
          trendDays={trendDays}
          onTrendDaysChange={setTrendDays}
        />
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Clinical alerts by severity</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/alerts"
            className="card p-4 hover:border-red-300 transition-colors border-red-100"
          >
            <p className="text-2xl font-bold text-red-700">
              {alertSeverityCounts.critical}
            </p>
            <p className="text-xs text-slate-500">Critical</p>
          </Link>
          <Link
            href="/alerts"
            className="card p-4 hover:border-amber-300 transition-colors border-amber-100"
          >
            <p className="text-2xl font-bold text-amber-700">
              {alertSeverityCounts.warning}
            </p>
            <p className="text-xs text-slate-500">Warning</p>
          </Link>
          <Link
            href="/alerts"
            className="card p-4 hover:border-slate-300 transition-colors"
          >
            <p className="text-2xl font-bold text-slate-700">
              {alertSeverityCounts.info}
            </p>
            <p className="text-xs text-slate-500">Info</p>
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/alerts" className="card p-4 hover:border-[#028090]/40">
          <Activity className="w-5 h-5 text-[#028090] mb-2" />
          <p className="text-2xl font-bold">{counts.openClinicalAlerts}</p>
          <p className="text-xs text-slate-500">Open alerts</p>
        </Link>
        <Link href="/escalations" className="card p-4 hover:border-[#028090]/40">
          <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold">{counts.openEscalations}</p>
          <p className="text-xs text-slate-500">Open escalations</p>
        </Link>
        <Link href="/incidents" className="card p-4 hover:border-[#028090]/40">
          <FileWarning className="w-5 h-5 text-orange-600 mb-2" />
          <p className="text-2xl font-bold">{counts.openIncidents}</p>
          <p className="text-xs text-slate-500">Open incidents</p>
        </Link>
        <Link href="/visit-review" className="card p-4 hover:border-[#028090]/40">
          <ClipboardCheck className="w-5 h-5 text-[#028090] mb-2" />
          <p className="text-2xl font-bold">{counts.pendingVisitReviews}</p>
          <p className="text-xs text-slate-500">Visits to review</p>
        </Link>
        <Link href="/schedule" className="card p-4 hover:border-[#028090]/40">
          <CalendarX className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold">{counts.missedVisitsToday}</p>
          <p className="text-xs text-slate-500">Missed visits today</p>
        </Link>
        <Link href="/supervisor" className="card p-4 hover:border-[#028090]/40">
          <CreditCard className="w-5 h-5 text-amber-600 mb-2" />
          <p className="text-2xl font-bold">{counts.expiringAuthorisations}</p>
          <p className="text-xs text-slate-500">Auth expiring (30d)</p>
        </Link>
        <Link href="/patients" className="card p-4 hover:border-[#028090]/40">
          <Users className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold">{counts.highRiskActivePatients}</p>
          <p className="text-xs text-slate-500">High / critical risk patients</p>
        </Link>
      </div>

      {dash.expiringAuthorisations.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Authorisations expiring soon</h2>
            <Link href="/supervisor" className="text-xs text-[#028090] hover:underline">
              Supervisor panel
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {dash.expiringAuthorisations.map((auth) => (
              <li key={auth.id} className="flex justify-between gap-2 flex-wrap">
                <Link
                  href={`/patients/${auth.patient.id}`}
                  className="text-[#028090] hover:underline font-medium"
                >
                  {auth.patient.fullName}
                </Link>
                <span className="text-slate-500">
                  {auth.payerName} · ends {formatDate(auth.endDate)} · {auth.unitsUsed}/
                  {auth.unitsAuthorised} units
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent alerts</h2>
            <Link href="/alerts" className="text-xs text-[#028090] hover:underline">
              Work queue
            </Link>
          </div>
          {dash.recentClinicalAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">No open alerts.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dash.recentClinicalAlerts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/patients/${a.patient.id}`}
                    className="font-medium text-[#028090] hover:underline"
                  >
                    {a.title}
                  </Link>
                  <span className="text-slate-500 block">
                    {a.patient.fullName} · {a.severity} · {formatDate(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent escalations</h2>
            <Link href="/escalations" className="text-xs text-[#028090] hover:underline">
              View all
            </Link>
          </div>
          {dash.recentEscalations.length === 0 ? (
            <p className="text-sm text-slate-500">None open.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dash.recentEscalations.map((e) => (
                <li key={e.id}>
                  <Link
                    href="/escalations"
                    className="font-medium text-slate-900 hover:text-[#028090]"
                  >
                    {e.title}
                  </Link>
                  <span className="text-slate-500 block">
                    {e.patient.fullName} · {e.severity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent incidents</h2>
            <Link href="/incidents" className="text-xs text-[#028090] hover:underline">
              View all
            </Link>
          </div>
          {dash.recentIncidents.length === 0 ? (
            <p className="text-sm text-slate-500">None open.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dash.recentIncidents.map((i) => (
                <li key={i.id}>
                  <Link
                    href="/incidents"
                    className="font-medium text-slate-900 hover:text-[#028090]"
                  >
                    {i.incidentType}
                  </Link>
                  <span className="text-slate-500 block">
                    {i.patient.fullName} · {i.severity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
