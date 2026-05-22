"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, FileText, Heart, Loader2, LogOut } from "lucide-react";
import { usePortalAuth } from "@/hooks/usePortalAuth";

type Overview = {
  patient: {
    fullName: string;
    status: string;
    riskLevel: string;
    primaryDiagnosis: string | null;
    city: string | null;
    region: string | null;
  };
};

export default function PortalHomePage() {
  const router = useRouter();
  const { session, isLoading, isAuthenticated, logout } = usePortalAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [carePlan, setCarePlan] = useState<unknown>(null);
  const [vitals, setVitals] = useState<unknown[]>([]);
  const [visits, setVisits] = useState<unknown[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/portal/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !session) return;
    const permissions = session.permissions;

    async function load() {
      try {
        const overviewRes = await fetch("/api/portal/overview", {
          credentials: "include",
        });
        const overviewJson = await overviewRes.json();
        if (overviewRes.ok) setOverview(overviewJson.data);

        if (permissions.canViewCarePlan) {
          const cpRes = await fetch("/api/portal/care-plan", {
            credentials: "include",
          });
          const cpJson = await cpRes.json();
          if (cpRes.ok) setCarePlan(cpJson.data);
        }

        if (permissions.canViewVitals) {
          const vRes = await fetch("/api/portal/vitals?limit=10", {
            credentials: "include",
          });
          const vJson = await vRes.json();
          if (vRes.ok) setVitals(vJson.data || []);
        }

        if (permissions.canViewSchedule) {
          const visitRes = await fetch("/api/portal/visits?days=30", {
            credentials: "include",
          });
          const visitJson = await visitRes.json();
          if (visitRes.ok) setVisits(visitJson.data || []);
        }
      } catch {
        setLoadError("Some portal data could not be loaded.");
      }
    }

    load();
  }, [isAuthenticated, session]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
      </div>
    );
  }

  if (!session) return null;

  const portalTitle =
    session.subjectType === "patient"
      ? "Patient Portal"
      : `Family Caregiver · ${session.familyCaregiver?.relationship || "Caregiver"}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#028090]">
            {portalTitle}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {session.patient.fullName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{session.org.name}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      {loadError && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          {loadError}
        </p>
      )}

      {overview?.patient && (
        <section className="bg-white rounded-2xl border border-slate-100 p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-[#028090]" />
            <h2 className="font-semibold text-slate-900">Care overview</h2>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900 capitalize">
                {overview.patient.status.replace("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Risk level</dt>
              <dd className="font-medium text-slate-900 capitalize">
                {overview.patient.riskLevel}
              </dd>
            </div>
            {overview.patient.primaryDiagnosis && (
              <div className="col-span-2">
                <dt className="text-slate-500">Primary diagnosis</dt>
                <dd className="font-medium text-slate-900">
                  {overview.patient.primaryDiagnosis}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {session.permissions.canViewCarePlan && (
        <section className="bg-white rounded-2xl border border-slate-100 p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-[#028090]" />
            <h2 className="font-semibold text-slate-900">Active care plan</h2>
          </div>
          {carePlan ? (
            <div className="text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                {(carePlan as { title?: string }).title}
              </p>
              <p className="text-slate-500 mt-1">
                Version {(carePlan as { version?: number }).version} ·{" "}
                {(carePlan as { status?: string }).status}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No active care plan on file.</p>
          )}
        </section>
      )}

      {session.permissions.canViewSchedule && (
        <section className="bg-white rounded-2xl border border-slate-100 p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-[#028090]" />
            <h2 className="font-semibold text-slate-900">Upcoming visits</h2>
          </div>
          {visits.length === 0 ? (
            <p className="text-sm text-slate-500">No scheduled visits in the next 30 days.</p>
          ) : (
            <ul className="space-y-3">
              {(visits as Array<{
                id: string;
                visitType: string;
                status: string;
                scheduledAt: string;
                loggedBy?: { fullName: string };
              }>).map((visit) => (
                <li
                  key={visit.id}
                  className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium text-slate-900">{visit.visitType}</p>
                    <p className="text-slate-500 capitalize">{visit.status}</p>
                  </div>
                  <p className="text-slate-600">
                    {new Date(visit.scheduledAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {session.permissions.canViewVitals && (
        <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-3">Recent vitals</h2>
          {vitals.length === 0 ? (
            <p className="text-sm text-slate-500">No vitals recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(vitals as Array<{
                id: string;
                recordedAt: string;
                systolicBp?: number;
                diastolicBp?: number;
                heartRate?: number;
              }>).map((v) => (
                <li key={v.id} className="flex justify-between text-slate-700">
                  <span>
                    {v.systolicBp && v.diastolicBp
                      ? `BP ${v.systolicBp}/${v.diastolicBp}`
                      : "Vitals"}
                    {v.heartRate ? ` · HR ${v.heartRate}` : ""}
                  </span>
                  <span className="text-slate-500">
                    {new Date(v.recordedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
