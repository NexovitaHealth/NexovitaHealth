"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { formatDateTime, getInitials } from "@/lib/utils";
import {
  Shield,
  Search,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatAuditMetadata } from "@/lib/audit-events";

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-100 text-emerald-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  viewed: "bg-slate-100 text-slate-600",
  login: "bg-purple-100 text-purple-700",
  logout: "bg-slate-100 text-slate-500",
  status_changed: "bg-teal-100 text-teal-700",
  exported: "bg-amber-100 text-amber-700",
  invited: "bg-pink-100 text-pink-700",
  removed: "bg-orange-100 text-orange-700",
  password_changed: "bg-indigo-100 text-indigo-700",
  file_uploaded: "bg-cyan-100 text-cyan-700",
  file_deleted: "bg-rose-100 text-rose-700",
};

const ACTION_OPTIONS = Object.keys(ACTION_COLORS);

const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "All resources" },
  { value: "claim", label: "Claims" },
  { value: "portal_message", label: "Portal messages" },
  { value: "message", label: "Staff messages" },
  { value: "patient", label: "Patients" },
  { value: "visit", label: "Visits" },
  { value: "clinical_alert", label: "Clinical alerts" },
];

export default function AuditPage() {
  const { request, orgId } = useApi();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (actionFilter) params.set("action", actionFilter);
  if (resourceFilter) params.set("resourceType", resourceFilter);
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", orgId, page, actionFilter, resourceFilter, search],
    queryFn: () => request(`/api/orgs/{orgId}/audit?${params}`),
    enabled: !!orgId,
  });

  const logs = (data?.data ?? []) as Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    createdAt: string;
    metadata?: Record<string, string>;
    actor?: { fullName: string; email: string };
  }>;
  const pagination = data?.pagination || { total: 0, totalPages: 1 };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#028090]" /> Audit Log
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete activity trail for compliance and security
          </p>
        </div>
        <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
          {pagination.total.toLocaleString()} events
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
            placeholder="Search logs..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
          >
            {RESOURCE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Shield className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-500">No audit logs found</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-40">
                    Timestamp
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-24">
                    Action
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Resource
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    User
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(
                  (log: {
                    id: string;
                    action: string;
                    resourceType: string;
                    resourceId?: string;
                    createdAt: string;
                    metadata?: Record<string, string>;
                    actor?: { fullName: string; email: string };
                  }) => {
                    const actor = log.actor;
                    return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide ${ACTION_COLORS[log.action] || "bg-slate-100 text-slate-600"}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">
                          <span className="font-medium capitalize">
                            {log.resourceType?.replace(/_/g, " ")}
                          </span>
                          {log.resourceId && (
                            <span className="text-slate-400 text-xs ml-1.5 font-mono">
                              #{log.resourceId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {actor ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#028090] to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {getInitials(actor.fullName)}
                            </div>
                            <span className="text-sm text-slate-700">
                              {actor.fullName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            System
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-slate-500 max-w-sm truncate"
                        title={
                          log.metadata
                            ? JSON.stringify(log.metadata)
                            : undefined
                        }
                      >
                        {formatAuditMetadata(
                          log.resourceType,
                          log.metadata as Record<string, unknown> | undefined,
                        )}
                      </td>
                    </tr>
                    );
                  },
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Page {page} of {pagination.totalPages} · {pagination.total}{" "}
                  total events
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={page === pagination.totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
