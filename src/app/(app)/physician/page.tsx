"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  FileSignature,
  Loader2,
  Stethoscope,
  Users,
} from "lucide-react";

type PortalSummary = {
  counts: {
    assignedPatientCount: number;
    draftOrders: number;
    carePlansToSign: number;
    openEscalations: number;
    criticalAlerts: number;
    pendingVisitReviews: number;
  };
  assignedPatients: Array<{
    id: string;
    fullName: string;
    riskLevel: string;
    status: string;
    primaryDiagnosis?: string | null;
    _count: { alerts: number; escalations: number };
  }>;
  recentDraftOrders: Array<{
    id: string;
    title: string;
    orderType: string;
    createdAt: string;
    patient: { id: string; fullName: string };
  }>;
  recentEscalations: Array<{
    id: string;
    title: string;
    severity: string;
    patient: { id: string; fullName: string };
  }>;
  carePlansPendingSign: Array<{
    id: string;
    title: string;
    version: number;
    updatedAt: string;
    patient: { id: string; fullName: string };
    author: { fullName: string };
  }>;
};

export default function PhysicianPortalPage() {
  const { request, orgId } = useApi();
  const { can } = usePermissions();
  const canView = can("physician:portal");

  const { data, isLoading } = useQuery({
    queryKey: ["physician-portal", orgId],
    queryFn: () =>
      request<PortalSummary>(`/api/orgs/{orgId}/physician-portal`),
    enabled: !!orgId && canView,
  });

  const portal = data?.data as PortalSummary | undefined;

  if (!canView) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Physician portal is for physician roles only.
      </div>
    );
  }

  if (isLoading || !portal) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
      </div>
    );
  }

  const { counts } = portal;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-[#028090]" />
          Physician portal
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Assigned patients, orders to sign, escalations, and clinical review
          work.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/patients?assignedToMe=true"
          className="card p-4 hover:border-[#028090]/40 transition-colors"
        >
          <Users className="w-5 h-5 text-[#028090] mb-2" />
          <p className="text-2xl font-bold">{counts.assignedPatientCount}</p>
          <p className="text-xs text-slate-500">Assigned patients</p>
        </Link>
        <Link
          href="/physician-orders?status=draft"
          className="card p-4 hover:border-[#028090]/40"
        >
          <FileSignature className="w-5 h-5 text-amber-600 mb-2" />
          <p className="text-2xl font-bold">{counts.draftOrders}</p>
          <p className="text-xs text-slate-500">Draft orders to sign</p>
        </Link>
        <Link href="/escalations" className="card p-4 hover:border-[#028090]/40">
          <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold">{counts.openEscalations}</p>
          <p className="text-xs text-slate-500">Open escalations (caseload)</p>
        </Link>
        <Link href="/alerts" className="card p-4 hover:border-[#028090]/40">
          <Activity className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold">{counts.criticalAlerts}</p>
          <p className="text-xs text-slate-500">Critical alerts (caseload)</p>
        </Link>
        <Link
          href="/visit-review"
          className="card p-4 hover:border-[#028090]/40"
        >
          <ClipboardCheck className="w-5 h-5 text-[#028090] mb-2" />
          <p className="text-2xl font-bold">{counts.pendingVisitReviews}</p>
          <p className="text-xs text-slate-500">Visits pending review</p>
        </Link>
        <div className="card p-4 bg-slate-50/80">
          <FileSignature className="w-5 h-5 text-slate-500 mb-2" />
          <p className="text-2xl font-bold">{counts.carePlansToSign}</p>
          <p className="text-xs text-slate-500">Care plans awaiting signature</p>
        </div>
      </div>

      {portal.carePlansPendingSign.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-3">
            Care plans awaiting signature
          </h2>
          <ul className="space-y-2 text-sm">
            {portal.carePlansPendingSign.map((plan) => (
              <li key={plan.id} className="flex flex-wrap justify-between gap-2">
                <Link
                  href={`/patients/${plan.patient.id}`}
                  className="text-[#028090] font-medium hover:underline"
                >
                  {plan.title} (v{plan.version}) — {plan.patient.fullName}
                </Link>
                <span className="text-slate-500">
                  by {plan.author.fullName} · updated{" "}
                  {formatDateTime(plan.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {portal.recentDraftOrders.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent draft orders</h2>
            <Link
              href="/physician-orders?status=draft"
              className="text-xs text-[#028090] hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {portal.recentDraftOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/patients/${order.patient.id}`}
                  className="font-medium text-[#028090] hover:underline"
                >
                  {order.title}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  — {order.patient.fullName} · {order.orderType} ·{" "}
                  {formatDateTime(order.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Assigned patients</h2>
            <Link
              href="/patients?assignedToMe=true"
              className="text-xs text-[#028090] hover:underline"
            >
              View all
            </Link>
          </div>
          {portal.assignedPatients.length === 0 ? (
            <p className="text-sm text-slate-500">
              No patients on your care team yet. Ask a supervisor to assign you
              on a patient chart.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {portal.assignedPatients.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <Link
                    href={`/patients/${p.id}`}
                    className="font-medium text-[#028090] hover:underline"
                  >
                    {p.fullName}
                  </Link>
                  <span className="text-slate-500 capitalize">
                    {p.riskLevel} risk
                    {p._count.alerts > 0 && ` · ${p._count.alerts} alerts`}
                    {p._count.escalations > 0 &&
                      ` · ${p._count.escalations} escalations`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent escalations</h2>
            <Link
              href="/escalations"
              className="text-xs text-[#028090] hover:underline"
            >
              View queue
            </Link>
          </div>
          {portal.recentEscalations.length === 0 ? (
            <p className="text-sm text-slate-500">None open on your caseload.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {portal.recentEscalations.map((e) => (
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
      </div>
    </div>
  );
}
