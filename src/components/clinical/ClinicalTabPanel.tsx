"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";

type CarePlan = {
  id: string;
  title: string;
  version: number;
  status: string;
  signedAt?: string | null;
  reviewDate?: string | null;
  startDate?: string | null;
  goals?: unknown;
  interventions?: unknown;
  signedBy?: { fullName: string };
  physicianOrders?: Array<{
    id: string;
    title: string;
    status: string;
    orderType: string;
    instructions?: string;
    signedAt?: string | null;
    physician?: { fullName: string };
  }>;
};

const EDITORS = [
  "agency_admin",
  "supervisor",
  "physician",
  "physician_independent",
];
const PHYSICIANS = ["physician", "physician_independent"];

function linesFromJson(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .join("\n");
}

function jsonFromLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ClinicalTabPanel({
  patientId,
  orgId,
  carePlans,
  request,
}: {
  patientId: string;
  orgId: string;
  carePlans?: unknown[];
  request: (path: string, options?: RequestInit) => Promise<{ success?: boolean; error?: string }>;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const plans = (carePlans ?? []) as CarePlan[];
  const plan = plans[0];
  const canEdit = EDITORS.includes(user?.role || "");
  const isPhysician = PHYSICIANS.includes(user?.role || "");
  const isMutable = plan && !plan.signedAt && plan.status !== "discontinued";

  const [mode, setMode] = useState<"view" | "create" | "edit">(
    plans.length === 0 && canEdit ? "create" : "view",
  );
  const [form, setForm] = useState({
    title: plan?.title || "Care plan",
    goalsText: linesFromJson(plan?.goals),
    interventionsText: linesFromJson(plan?.interventions),
    reviewDate: plan?.reviewDate?.slice(0, 10) || "",
    startDate: plan?.startDate?.slice(0, 10) || "",
  });
  const [orderForm, setOrderForm] = useState({
    orderType: "medication",
    title: "",
    instructions: "",
  });
  const [discontinueId, setDiscontinueId] = useState<string | null>(null);
  const [discontinueReason, setDiscontinueReason] = useState("");
  const [message, setMessage] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["patient", orgId, patientId] });

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        goals: jsonFromLines(form.goalsText),
        interventions: jsonFromLines(form.interventionsText),
        reviewDate: form.reviewDate
          ? new Date(`${form.reviewDate}T12:00:00`).toISOString()
          : undefined,
        startDate: form.startDate
          ? new Date(`${form.startDate}T12:00:00`).toISOString()
          : undefined,
      };
      if (mode === "create") {
        return request(`/api/orgs/${orgId}/care-plans`, {
          method: "POST",
          body: JSON.stringify({
            patientId,
            ...payload,
            status: "draft",
          }),
        });
      }
      return request(`/api/orgs/${orgId}/care-plans/${plan!.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res) => {
      if (!res?.success) {
        setMessage(res?.error || "Save failed");
        return;
      }
      setMessage("");
      setMode("view");
      invalidate();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const signPlanMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/${orgId}/care-plans/${plan!.id}/sign`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => invalidate(),
  });

  const renewMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/${orgId}/care-plans/${plan!.id}/renew`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          goals: jsonFromLines(form.goalsText),
          interventions: jsonFromLines(form.interventionsText),
        }),
      }),
    onSuccess: () => {
      setMode("view");
      invalidate();
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/${orgId}/physician-orders`, {
        method: "POST",
        body: JSON.stringify({
          patientId,
          carePlanId: plan?.id,
          ...orderForm,
          status: "draft",
        }),
      }),
    onSuccess: () => {
      setOrderForm({ orderType: "medication", title: "", instructions: "" });
      invalidate();
    },
  });

  const signOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      request(`/api/orgs/${orgId}/physician-orders/${orderId}/sign`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => invalidate(),
  });

  const discontinueMutation = useMutation({
    mutationFn: (orderId: string) =>
      request(`/api/orgs/${orgId}/physician-orders/${orderId}/discontinue`, {
        method: "POST",
        body: JSON.stringify({ reason: discontinueReason }),
      }),
    onSuccess: () => {
      setDiscontinueId(null);
      setDiscontinueReason("");
      invalidate();
    },
  });

  if (!canEdit && plans.length === 0) {
    return (
      <p className="text-sm text-slate-500">No active care plan on file.</p>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {message && (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{message}</p>
      )}

      {canEdit && mode !== "view" && (
        <form
          className="card p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            savePlanMutation.mutate();
          }}
        >
          <h3 className="font-semibold text-slate-800">
            {mode === "create" ? "New care plan" : "Edit care plan"}
          </h3>
          <label className="block text-sm">
            Title
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Goals (one per line)
            <textarea
              rows={4}
              value={form.goalsText}
              onChange={(e) =>
                setForm((f) => ({ ...f, goalsText: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Interventions (one per line)
            <textarea
              rows={4}
              value={form.interventionsText}
              onChange={(e) =>
                setForm((f) => ({ ...f, interventionsText: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              Start date
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              Review date
              <input
                type="date"
                value={form.reviewDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reviewDate: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savePlanMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
            >
              {savePlanMutation.isPending ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              className="px-4 py-2 rounded-lg border text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {plan && mode === "view" && (
        <>
          <div className="card p-5">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="font-semibold text-slate-800">{plan.title}</h3>
                <p className="text-sm text-slate-500">
                  Version {plan.version} · {plan.status}
                  {plan.signedBy && ` · Signed by ${plan.signedBy.fullName}`}
                </p>
                {plan.reviewDate && (
                  <p className="text-xs text-slate-400 mt-1">
                    Review due {formatDate(plan.reviewDate)}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {isMutable && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          title: plan.title,
                          goalsText: linesFromJson(plan.goals),
                          interventionsText: linesFromJson(plan.interventions),
                          reviewDate: plan.reviewDate?.slice(0, 10) || "",
                          startDate: plan.startDate?.slice(0, 10) || "",
                        });
                        setMode("edit");
                      }}
                      className="text-sm text-[#028090] font-medium"
                    >
                      Edit
                    </button>
                  )}
                  {plan.signedAt && (
                    <button
                      type="button"
                      onClick={() => renewMutation.mutate()}
                      disabled={renewMutation.isPending}
                      className="text-sm text-slate-600 font-medium"
                    >
                      Renew
                    </button>
                  )}
                  {isPhysician && !plan.signedAt && (
                    <button
                      type="button"
                      onClick={() => signPlanMutation.mutate()}
                      disabled={signPlanMutation.isPending}
                      className="text-sm px-3 py-1 rounded-lg bg-[#028090] text-white"
                    >
                      Sign plan
                    </button>
                  )}
                </div>
              )}
            </div>
            {(linesFromJson(plan.goals) || linesFromJson(plan.interventions)) && (
              <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
                {linesFromJson(plan.goals) && (
                  <div>
                    <p className="font-medium text-slate-700 mb-1">Goals</p>
                    <ul className="list-disc pl-5 text-slate-600 space-y-0.5">
                      {jsonFromLines(linesFromJson(plan.goals)).map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {linesFromJson(plan.interventions) && (
                  <div>
                    <p className="font-medium text-slate-700 mb-1">Interventions</p>
                    <ul className="list-disc pl-5 text-slate-600 space-y-0.5">
                      {jsonFromLines(linesFromJson(plan.interventions)).map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">
              Physician orders
            </h3>
            {plan.physicianOrders && plan.physicianOrders.length > 0 ? (
              <ul className="space-y-3 mb-4">
                {plan.physicianOrders.map((order) => (
                  <li
                    key={order.id}
                    className="border border-slate-100 rounded-lg p-3 text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        {order.title}
                      </span>
                      <span className="text-slate-500 capitalize">
                        {order.status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-1">
                      {order.orderType}
                      {order.physician?.fullName &&
                        ` · ${order.physician.fullName}`}
                    </p>
                    {order.instructions && (
                      <p className="text-slate-600 mt-2">{order.instructions}</p>
                    )}
                    {canEdit &&
                      !["discontinued", "cancelled"].includes(order.status) && (
                        <div className="flex gap-2 mt-2">
                          {isPhysician && !order.signedAt && (
                            <button
                              type="button"
                              onClick={() => signOrderMutation.mutate(order.id)}
                              className="text-xs text-[#028090] font-medium"
                            >
                              Sign order
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDiscontinueId(order.id)}
                            className="text-xs text-red-600"
                          >
                            Discontinue
                          </button>
                        </div>
                      )}
                    {discontinueId === order.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={discontinueReason}
                          onChange={(e) => setDiscontinueReason(e.target.value)}
                          placeholder="Reason"
                          className="flex-1 rounded border px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => discontinueMutation.mutate(order.id)}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 mb-4">No physician orders yet.</p>
            )}

            {canEdit && (
              <form
                className="border-t pt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createOrderMutation.mutate();
                }}
              >
                <p className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> New order
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select
                    value={orderForm.orderType}
                    onChange={(e) =>
                      setOrderForm((f) => ({ ...f, orderType: e.target.value }))
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="medication">Medication</option>
                    <option value="therapy">Therapy</option>
                    <option value="lab">Lab</option>
                    <option value="dme">DME</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    required
                    placeholder="Order title"
                    value={orderForm.title}
                    onChange={(e) =>
                      setOrderForm((f) => ({ ...f, title: e.target.value }))
                    }
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  required
                  rows={2}
                  placeholder="Instructions"
                  value={orderForm.instructions}
                  onChange={(e) =>
                    setOrderForm((f) => ({
                      ...f,
                      instructions: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm"
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Add order"
                  )}
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {canEdit && !plan && mode === "view" && (
        <button
          type="button"
          onClick={() => setMode("create")}
          className="text-sm text-[#028090] font-medium flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Create care plan
        </button>
      )}
    </div>
  );
}
