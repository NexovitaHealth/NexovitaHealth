"use client";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { isPhysicianPortalRole } from "@/lib/physician-nav";
import {
  assignedToMeFromScope,
  caseloadScopeFromParam,
  type PatientCaseloadScope,
} from "@/lib/patient-list-scope";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Users,
  Plus,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { riskColor, statusColor, formatDate } from "@/lib/utils";
import Link from "next/link";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { PatientListFilters } from "@/components/patients/PatientListFilters";

function PatientsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { orgId } = useApi();
  const { request } = useApi();
  const { user } = useAuth();
  const { can } = usePermissions();

  const search = searchParams.get("search") ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const riskFilter = searchParams.get("riskLevel") ?? "";

  const physicianMode =
    isPhysicianPortalRole(user?.role) || can("physician:portal");

  const [caseloadScope, setCaseloadScope] = useState<PatientCaseloadScope>(
    () => caseloadScopeFromParam(physicianMode, searchParams.get("assignedToMe")),
  );

  useEffect(() => {
    if (!physicianMode) return;
    setCaseloadScope(
      caseloadScopeFromParam(true, searchParams.get("assignedToMe")),
    );
  }, [physicianMode, searchParams]);

  const assignedToMe = assignedToMeFromScope(physicianMode, caseloadScope);

  const applyCaseloadScope = (scope: PatientCaseloadScope) => {
    setCaseloadScope(scope);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("page");
    if (physicianMode) {
      if (scope === "all") next.set("assignedToMe", "false");
      else next.delete("assignedToMe");
    } else if (scope === "assigned") {
      next.set("assignedToMe", "true");
    } else {
      next.delete("assignedToMe");
    }
    const q = next.toString();
    router.replace(q ? `/patients?${q}` : "/patients", { scroll: false });
  };

  const [showNew, setShowNew] = useState(false);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const setPage = (next: number | ((p: number) => number)) => {
    const value = typeof next === "function" ? next(page) : next;
    const params = new URLSearchParams(searchParams.toString());
    if (value <= 1) params.delete("page");
    else params.set("page", String(value));
    const q = params.toString();
    router.replace(q ? `/patients?${q}` : "/patients", { scroll: false });
  };

  const buildListQuery = () => {
    const q = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (search) q.set("search", search);
    if (statusFilter) q.set("status", statusFilter);
    if (riskFilter) q.set("riskLevel", riskFilter);
    if (physicianMode) {
      q.set("assignedToMe", caseloadScope === "assigned" ? "true" : "false");
    } else if (assignedToMe) {
      q.set("assignedToMe", "true");
    }
    return q.toString();
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "patients",
      orgId,
      search,
      statusFilter,
      riskFilter,
      page,
      caseloadScope,
      physicianMode,
    ],
    queryFn: () =>
      request<any>(`/api/orgs/${orgId}/patients?${buildListQuery()}`),
    enabled: !!orgId,
  });

  const patients = (data?.data as unknown[]) || [];
  const pagination = data?.pagination;

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
            <p className="text-sm text-slate-500 mt-1">
              {assignedToMe
                ? `${pagination?.total ?? 0} patient${(pagination?.total ?? 0) === 1 ? "" : "s"} assigned to you`
                : `${pagination?.total ?? 0} patient${(pagination?.total ?? 0) === 1 ? "" : "s"} in organization`}
            </p>
          </div>
          {physicianMode && (
            <div
              className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm shadow-sm"
              role="group"
              aria-label="Patient list scope"
            >
              <button
                type="button"
                onClick={() => applyCaseloadScope("assigned")}
                className={`px-4 py-2 font-medium transition-colors ${
                  caseloadScope === "assigned"
                    ? "bg-[#028090] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                My patients
              </button>
              <button
                type="button"
                onClick={() => applyCaseloadScope("all")}
                className={`px-4 py-2 font-medium transition-colors border-l border-slate-200 ${
                  caseloadScope === "all"
                    ? "bg-[#028090] text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                All patients
              </button>
            </div>
          )}
        </div>
        {can("patient:create") && (
          <button
            onClick={() => setShowNew(true)}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Admit Patient
          </button>
        )}
      </div>

      {/* Mobile filters — desktop filters live in TopBar */}
      <PatientListFilters
        className="flex flex-col gap-3 md:hidden"
        selectClassName="input-base w-full text-sm"
      />

      {/* Patient Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Patient
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Diagnosis
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Risk
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Admitted
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Alerts
              </th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && patients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <Users className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm font-medium">
                    No patients found
                  </p>
                  <p className="text-slate-300 text-xs mt-1">
                    {search
                      ? "Try adjusting your search"
                      : assignedToMe
                        ? "Ask a supervisor to add you to a patient care team"
                        : "Start by admitting a patient"}
                  </p>
                </td>
              </tr>
            )}
            {patients.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4">
                  <Link
                    href={`/patients/${p.id}`}
                    className="flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#028090]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#028090] text-sm font-bold">
                        {p.fullName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 hover:text-[#028090] transition-colors">
                        {p.fullName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.dateOfBirth
                          ? `DOB: ${formatDate(p.dateOfBirth)}`
                          : "No DOB"}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <p className="text-sm text-slate-600 truncate max-w-[200px]">
                    {p.primaryDiagnosis || (
                      <span className="text-slate-300">—</span>
                    )}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <span className={`badge ${statusColor(p.status)}`}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`badge border ${riskColor(p.riskLevel)}`}>
                    {p.riskLevel}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-slate-500">
                  {p.admissionDate ? formatDate(p.admissionDate) : "—"}
                </td>
                <td className="px-4 py-4">
                  {(p._count?.alerts || 0) > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs font-semibold text-red-600">
                        {p._count.alerts}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-200">—</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <Link href={`/patients/${p.id}`}>
                    <ChevronRight className="w-4 h-4 text-slate-300 hover:text-slate-500 transition-colors" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * 20 + 1}–
              {Math.min(page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page === pagination.totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <NewPatientModal
          onClose={() => setShowNew(false)}
          onSuccess={() => {
            setShowNew(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading patients...</div>}>
      <PatientsPageContent />
    </Suspense>
  );
}
