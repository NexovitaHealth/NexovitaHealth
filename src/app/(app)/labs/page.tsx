"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { formatDate, formatRelative } from "@/lib/utils";
import {
  FlaskConical,
  Search,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

const STATUS_STYLES: Record<string, { color: string; icon: React.ReactNode }> =
  {
    pending: {
      color: "bg-amber-100 text-amber-700",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    resulted: {
      color: "bg-emerald-100 text-emerald-700",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    critical: {
      color: "bg-red-100 text-red-700",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    cancelled: { color: "bg-slate-100 text-slate-500", icon: null },
  };

function parseResultLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [componentName, value, unit] = line.split("|").map((s) => s.trim());
      return {
        componentName: componentName || "Result",
        value: value || "",
        unit: unit || undefined,
      };
    })
    .filter((r) => r.value);
}

export default function LabsPage() {
  const { request, orgId } = useApi();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showOrder, setShowOrder] = useState(false);
  const [resultLines, setResultLines] = useState("");
  const [orderForm, setOrderForm] = useState({
    patientId: "",
    panelName: "",
    priority: "routine",
  });

  const { data: patientsData } = useQuery({
    queryKey: ["patients", orgId, "labs"],
    queryFn: () =>
      request<{ id: string; fullName: string }[]>(
        `/api/orgs/{orgId}/patients?pageSize=200`,
      ),
    enabled: !!orgId && showOrder,
  });
  const patients = (patientsData?.data as { id: string; fullName: string }[]) || [];

  const createOrderMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/{orgId}/labs`, {
        method: "POST",
        body: JSON.stringify(orderForm),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labs"] });
      setShowOrder(false);
      setOrderForm({ patientId: "", panelName: "", priority: "routine" });
    },
  });

  const addResultsMutation = useMutation({
    mutationFn: (labOrderId: string) =>
      request(`/api/orgs/{orgId}/labs/${labOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          results: parseResultLines(resultLines),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labs"] });
      setResultLines("");
      setExpanded(null);
    },
  });

  const params = new URLSearchParams({ limit: "50" });
  if (search) params.set("search", search);
  if (statusFilter) params.set("status", statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ["labs", orgId, search, statusFilter],
    queryFn: () => request(`/api/orgs/{orgId}/labs?${params}`),
    enabled: !!orgId,
  });

  const labs = (data?.data ?? []) as Array<{
    id: string;
    testName: string;
    status: string;
    orderedAt: string;
    resultDate?: string;
    notes?: string;
    criticalValues?: string;
    patient?: { firstName: string; lastName: string; id: string };
    orderedBy?: { fullName: string };
    results?: Array<{
      component: string;
      value: string;
      unit: string;
      referenceRange?: string;
      isAbnormal: boolean;
    }>;
  }>;
  const pendingCount = labs.filter((l) => l.status === "pending").length;
  const criticalCount = labs.filter((l) => l.status === "critical").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-[#028090]" /> Lab Results
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Lab orders and results across all patients
            {criticalCount > 0 && (
              <span className="ml-2 font-semibold text-red-600">
                · {criticalCount} critical
              </span>
            )}
            {pendingCount > 0 && (
              <span className="ml-1 text-amber-600">
                · {pendingCount} pending
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: "Total Orders",
            value: labs.length,
            color: "text-slate-700",
          },
          { label: "Pending", value: pendingCount, color: "text-amber-600" },
          { label: "Critical", value: criticalCount, color: "text-red-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-slate-200 px-4 py-3"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setShowOrder((v) => !v)}
          className="text-sm px-3 py-2 rounded-lg bg-[#028090] text-white font-medium"
        >
          {showOrder ? "Cancel" : "Order lab"}
        </button>
      </div>

      {showOrder && (
        <form
          className="bg-white border rounded-2xl p-5 mb-5 grid sm:grid-cols-3 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            createOrderMutation.mutate();
          }}
        >
          <select
            required
            value={orderForm.patientId}
            onChange={(e) =>
              setOrderForm((f) => ({ ...f, patientId: e.target.value }))
            }
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Panel name"
            value={orderForm.panelName}
            onChange={(e) =>
              setOrderForm((f) => ({ ...f, panelName: e.target.value }))
            }
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm"
          >
            Submit order
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090]"
            placeholder="Search labs or patients..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#028090]/25 focus:border-[#028090] bg-white"
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_STYLES).map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Lab list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : labs.length === 0 ? (
          <div className="text-center py-16">
            <FlaskConical className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No lab orders found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {labs.map(
              (lab: {
                id: string;
                testName: string;
                status: string;
                orderedAt: string;
                resultDate?: string;
                notes?: string;
                criticalValues?: string;
                patient?: { firstName: string; lastName: string; id: string };
                orderedBy?: { fullName: string };
                results?: Array<{
                  component: string;
                  value: string;
                  unit: string;
                  referenceRange?: string;
                  isAbnormal?: boolean;
                }>;
              }) => {
                const s = STATUS_STYLES[lab.status] || STATUS_STYLES.pending;
                const isExpanded = expanded === lab.id;
                return (
                  <div key={lab.id}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : lab.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors text-left"
                    >
                      <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {lab.testName}
                          </p>
                          {lab.patient && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {lab.patient.firstName} {lab.patient.lastName}
                            </p>
                          )}
                        </div>
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold w-fit ${s.color}`}
                        >
                          {s.icon}
                          {lab.status.charAt(0).toUpperCase() +
                            lab.status.slice(1)}
                        </div>
                        <div className="text-sm text-slate-500">
                          <p className="text-xs text-slate-400">Ordered</p>
                          {formatDate(lab.orderedAt)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {lab.resultDate && (
                            <>
                              <p className="text-xs text-slate-400">Result</p>
                              {formatDate(lab.resultDate)}
                            </>
                          )}
                          {lab.orderedBy && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              By {lab.orderedBy.fullName}
                            </p>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-100 px-5 py-4">
                        {lab.criticalValues && (
                          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <strong>Critical:</strong> {lab.criticalValues}
                            </div>
                          </div>
                        )}
                        {lab.results && lab.results.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-slate-500 border-b border-slate-200">
                                <th className="text-left pb-2 font-semibold">
                                  Component
                                </th>
                                <th className="text-left pb-2 font-semibold">
                                  Value
                                </th>
                                <th className="text-left pb-2 font-semibold">
                                  Reference Range
                                </th>
                                <th className="text-left pb-2 font-semibold">
                                  Flag
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {lab.results.map((r, i) => (
                                <tr
                                  key={i}
                                  className={
                                    r.isAbnormal
                                      ? "text-red-700"
                                      : "text-slate-700"
                                  }
                                >
                                  <td className="py-2 font-medium">
                                    {r.component}
                                  </td>
                                  <td className="py-2">
                                    {r.value} {r.unit}
                                  </td>
                                  <td className="py-2 text-slate-400">
                                    {r.referenceRange || "—"}
                                  </td>
                                  <td className="py-2">
                                    {r.isAbnormal && (
                                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                                        Abnormal
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : lab.status === "ordered" ? (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500">
                              Enter results (one per line: Component|value|unit)
                            </p>
                            <textarea
                              rows={4}
                              value={expanded === lab.id ? resultLines : ""}
                              onChange={(e) => setResultLines(e.target.value)}
                              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                              placeholder="Glucose|95|mg/dL"
                            />
                            <button
                              type="button"
                              onClick={() => addResultsMutation.mutate(lab.id)}
                              className="text-sm px-3 py-1.5 rounded-lg bg-[#028090] text-white"
                            >
                              Save results
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">
                            No result details available
                          </p>
                        )}
                        {lab.notes && (
                          <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
                            Notes: {lab.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
