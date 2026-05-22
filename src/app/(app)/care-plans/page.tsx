"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ClipboardList,
  Loader2,
  History,
  FileSignature,
} from "lucide-react";

type CarePlanRow = {
  id: string;
  title: string;
  status: string;
  version: number;
  signedAt?: string | null;
  updatedAt: string;
  reviewDate?: string | null;
  patient: { id: string; fullName: string };
  author: { fullName: string };
  signedBy?: { fullName: string } | null;
  parentCarePlan?: { id: string; title: string; version: number } | null;
  _count?: { renewals: number };
};

type CarePlansResponse = {
  data: CarePlanRow[];
  pagination?: { total: number };
  meta?: { unsignedCount: number };
};

type VersionEntry = {
  id: string;
  title: string;
  status: string;
  version: number;
  signedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author: { fullName: string };
  signedBy?: { fullName: string; npiNumber?: string | null } | null;
};

type HistoryResponse = {
  anchorId: string;
  rootId: string;
  patient: { id: string; fullName: string } | null;
  versions: VersionEntry[];
};

const STATUS_OPTIONS = [
  "",
  "draft",
  "active",
  "superseded",
  "expired",
  "discontinued",
] as const;

const statusBadge: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-800",
  superseded: "bg-amber-100 text-amber-800",
  expired: "bg-orange-100 text-orange-800",
  discontinued: "bg-red-100 text-red-800",
};

function CarePlansPageContent() {
  const searchParams = useSearchParams();
  const { request, orgId } = useApi();
  const { can } = usePermissions();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [unsignedOnly, setUnsignedOnly] = useState(
    () => searchParams.get("unsignedOnly") === "true",
  );

  useEffect(() => {
    setUnsignedOnly(searchParams.get("unsignedOnly") === "true");
  }, [searchParams]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canView = can("careplan:read");

  const { data, isLoading } = useQuery({
    queryKey: ["care-plans", orgId, statusFilter, search, unsignedOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "50" });
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      if (unsignedOnly) params.set("unsignedOnly", "true");
      const res = await request<CarePlanRow[]>(
        `/api/orgs/{orgId}/care-plans?${params}`,
      );
      return res as CarePlansResponse;
    },
    enabled: !!orgId && canView,
  });

  const plans = data?.data ?? [];
  const unsignedCount = data?.meta?.unsignedCount ?? 0;
  const selected = plans.find((p) => p.id === selectedId) ?? plans[0];

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["care-plan-history", orgId, selected?.id],
    queryFn: () =>
      request<HistoryResponse>(
        `/api/orgs/{orgId}/care-plans/${selected!.id}/history`,
      ),
    enabled: !!orgId && !!selected?.id && canView,
  });

  const history = historyData?.data as HistoryResponse | undefined;

  if (!canView) {
    return (
      <div className="p-8 text-sm text-slate-500">
        You do not have permission to view care plans.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#028090]" />
            Care plans
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Org-wide care plan browser with version history
          </p>
        </div>
        {unsignedCount > 0 && (
          <button
            type="button"
            onClick={() => setUnsignedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              unsignedOnly
                ? "bg-amber-600 text-white"
                : "bg-amber-100 text-amber-800 hover:bg-amber-200"
            }`}
          >
            <FileSignature className="w-4 h-4" />
            {unsignedCount} awaiting signature
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search patient or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base flex-1 min-w-[200px] max-w-sm text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base w-40 text-sm capitalize"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s.replace(/_/g, " ") : "All statuses"}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 px-2">
          <input
            type="checkbox"
            checked={unsignedOnly}
            onChange={(e) => setUnsignedOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          Unsigned only
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-sm text-slate-500 py-12 text-center">
          No care plans match your filters.
        </p>
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          <ul className="lg:col-span-2 space-y-2 max-h-[70vh] overflow-y-auto">
            {plans.map((plan) => {
              const active = selected?.id === plan.id;
              return (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(plan.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-[#028090] bg-[#028090]/5"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="font-semibold text-slate-900 truncate">
                      {plan.title}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {plan.patient.fullName} · v{plan.version}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusBadge[plan.status] ?? "bg-slate-100"}`}
                      >
                        {plan.status}
                      </span>
                      {!plan.signedAt && (
                        <span className="text-xs text-amber-700">
                          Needs signature
                        </span>
                      )}
                      {(plan._count?.renewals ?? 0) > 0 && (
                        <span className="text-xs text-slate-500">
                          +{plan._count?.renewals} renewal
                          {(plan._count?.renewals ?? 0) === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="lg:col-span-3 card p-5 min-h-[320px]">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a care plan.</p>
            ) : (
              <>
                <div className="flex flex-wrap justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selected.title}
                    </h2>
                    <p className="text-sm text-slate-600">
                      <Link
                        href={`/patients/${selected.patient.id}`}
                        className="text-[#028090] hover:underline"
                      >
                        {selected.patient.fullName}
                      </Link>
                      {" · "}v{selected.version} · {selected.author.fullName}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Updated {formatDateTime(selected.updatedAt)}
                      {selected.reviewDate &&
                        ` · Review ${formatDate(selected.reviewDate)}`}
                    </p>
                  </div>
                  <Link
                    href={`/patients/${selected.patient.id}`}
                    className="text-sm font-medium text-[#028090] hover:underline self-start"
                  >
                    Open chart
                  </Link>
                </div>

                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-[#028090]" />
                  Version history
                </h3>

                {historyLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-[#028090]" />
                ) : !history?.versions.length ? (
                  <p className="text-sm text-slate-500">No version chain found.</p>
                ) : (
                  <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                    {history.versions.map((v) => {
                      const isAnchor = v.id === history.anchorId;
                      const isCurrent =
                        v.id === history.versions[history.versions.length - 1]?.id;
                      return (
                        <li key={v.id} className="ml-5">
                          <span
                            className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${
                              isAnchor
                                ? "bg-[#028090]"
                                : isCurrent
                                  ? "bg-emerald-500"
                                  : "bg-slate-300"
                            }`}
                          />
                          <div
                            className={`rounded-lg p-3 text-sm ${
                              isAnchor ? "bg-[#028090]/5 border border-[#028090]/20" : "bg-slate-50"
                            }`}
                          >
                            <p className="font-medium text-slate-900">
                              v{v.version} — {v.title}
                              {isCurrent && (
                                <span className="ml-2 text-xs text-emerald-700">
                                  (latest)
                                </span>
                              )}
                            </p>
                            <p className="text-slate-600 capitalize mt-0.5">
                              {v.status}
                              {v.signedAt
                                ? ` · signed by ${v.signedBy?.fullName ?? "—"} ${formatDate(v.signedAt)}`
                                : " · unsigned"}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {v.author.fullName} · {formatDateTime(v.updatedAt)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CarePlansPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-slate-500">Loading care plans...</div>
      }
    >
      <CarePlansPageContent />
    </Suspense>
  );
}
