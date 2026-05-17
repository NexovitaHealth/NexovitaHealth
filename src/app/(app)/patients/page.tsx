"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Plus,
  Search,
  AlertTriangle,
  ChevronRight,
  Filter,
} from "lucide-react";
import { riskColor, statusColor, formatDate } from "@/lib/utils";
import Link from "next/link";
import { NewPatientModal } from "@/components/patients/NewPatientModal";

export default function PatientsPage() {
  const { orgId } = useApi();
  const { request } = useApi();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(riskFilter && { riskLevel: riskFilter }),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patients", orgId, search, statusFilter, riskFilter, page],
    queryFn: () => request<any>(`/api/orgs/${orgId}/patients?${params}`),
    enabled: !!orgId,
  });

  const patients = (data?.data as unknown[]) || [];
  const pagination = data?.pagination;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pagination?.total ?? 0} total patients in your caseload
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Admit Patient
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, diagnosis..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-base pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input-base w-36 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="intake">Intake</option>
          <option value="discharged">Discharged</option>
          <option value="on_hold">On Hold</option>
        </select>
        <select
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setPage(1);
          }}
          className="input-base w-36 text-sm"
        >
          <option value="">All Risk</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

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
