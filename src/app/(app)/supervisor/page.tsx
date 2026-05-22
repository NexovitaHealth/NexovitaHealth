"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import {
  Shield,
  Loader2,
  AlertTriangle,
  FileWarning,
  ClipboardCheck,
  CreditCard,
  Activity,
} from "lucide-react";

type Panel = {
  counts: {
    expiringAuthorisations: number;
    openEscalations: number;
    openIncidents: number;
    pendingVisitReviews: number;
    openClinicalAlerts: number;
    openCriticalAlerts: number;
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
  recentClinicalAlerts: Array<{
    id: string;
    title: string;
    severity: string;
    alertType: string;
    patient: { id: string; fullName: string };
  }>;
};

const ROLES = [
  "agency_admin",
  "supervisor",
  "physician",
  "physician_independent",
];

export default function SupervisorPanelPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["supervisor-panel", orgId],
    queryFn: () => request<Panel>(`/api/orgs/{orgId}/supervisor/panel`),
    enabled: !!orgId && ROLES.includes(user?.role || ""),
  });

  const panel = data?.data as Panel | undefined;

  if (!ROLES.includes(user?.role || "")) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Supervisor panel is for clinical leadership roles.
      </div>
    );
  }

  if (isLoading || !panel) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#028090]" />
          Supervisor panel
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Authorisation expiry, clinical alerts, escalations, incidents, and review backlog.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Link
          href="/billing"
          className="card p-4 hover:border-[#028090]/40 transition-colors"
        >
          <CreditCard className="w-5 h-5 text-amber-600 mb-2" />
          <p className="text-2xl font-bold">{panel.counts.expiringAuthorisations}</p>
          <p className="text-xs text-slate-500">Auth expiring (30d)</p>
        </Link>
        <Link href="/escalations" className="card p-4 hover:border-[#028090]/40">
          <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold">{panel.counts.openEscalations}</p>
          <p className="text-xs text-slate-500">Open escalations</p>
        </Link>
        <Link href="/incidents" className="card p-4 hover:border-[#028090]/40">
          <FileWarning className="w-5 h-5 text-orange-600 mb-2" />
          <p className="text-2xl font-bold">{panel.counts.openIncidents}</p>
          <p className="text-xs text-slate-500">Open incidents</p>
        </Link>
        <Link href="/visit-review" className="card p-4 hover:border-[#028090]/40">
          <ClipboardCheck className="w-5 h-5 text-[#028090] mb-2" />
          <p className="text-2xl font-bold">{panel.counts.pendingVisitReviews}</p>
          <p className="text-xs text-slate-500">Visits to review</p>
        </Link>
        <Link href="/alerts" className="card p-4 hover:border-[#028090]/40">
          <Activity className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold">
            {panel.counts.openClinicalAlerts}
            {panel.counts.openCriticalAlerts > 0 && (
              <span className="text-sm font-normal text-red-600 ml-1">
                ({panel.counts.openCriticalAlerts} critical)
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">Open clinical alerts</p>
        </Link>
      </div>

      {panel.expiringAuthorisations.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-3">
            Authorisations expiring soon
          </h2>
          <ul className="space-y-2 text-sm">
            {panel.expiringAuthorisations.map((auth) => (
              <li key={auth.id} className="flex justify-between gap-2">
                <Link
                  href={`/patients/${auth.patient.id}`}
                  className="text-[#028090] hover:underline"
                >
                  {auth.patient.fullName}
                </Link>
                <span className="text-slate-500">
                  {auth.payerName} · ends {formatDate(auth.endDate)} ·{" "}
                  {auth.unitsUsed}/{auth.unitsAuthorised} units
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent clinical alerts</h2>
            <Link href="/alerts" className="text-xs text-[#028090] hover:underline">
              View queue
            </Link>
          </div>
          {panel.recentClinicalAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">None open.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {panel.recentClinicalAlerts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/patients/${a.patient.id}`}
                    className="font-medium text-[#028090] hover:underline"
                  >
                    {a.title}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    — {a.patient.fullName} ({a.severity})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Recent escalations</h2>
          {panel.recentEscalations.length === 0 ? (
            <p className="text-sm text-slate-500">None open.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {panel.recentEscalations.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{e.title}</span>
                  <span className="text-slate-500">
                    {" "}
                    — {e.patient.fullName} ({e.severity})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Recent incidents</h2>
          {panel.recentIncidents.length === 0 ? (
            <p className="text-sm text-slate-500">None open.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {panel.recentIncidents.map((i) => (
                <li key={i.id}>
                  <span className="font-medium">{i.incidentType}</span>
                  <span className="text-slate-500">
                    {" "}
                    — {i.patient.fullName} ({i.severity})
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
