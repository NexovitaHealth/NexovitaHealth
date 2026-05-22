"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { DollarSign, Loader2 } from "lucide-react";

type QueueItem = {
  id: string;
  reviewedAt: string;
  patient: { id: string; fullName: string };
  visitLog: {
    id: string;
    visitType: string;
    scheduledAt: string;
    evvVerified: boolean;
    durationMinutes?: number;
  };
};

type Claim = {
  id: string;
  claimNumber: string | null;
  status: string;
  payerName: string;
  serviceCode: string;
  totalAmount: number;
  patient: { fullName: string };
  createdAt: string;
};

type Authorisation = {
  id: string;
  payerName: string;
  authorisationNumber: string;
  status: string;
  startDate: string;
  endDate: string;
  unitsAuthorised: number;
  unitsUsed: number;
  serviceCode: string | null;
  patient: { id: string; fullName: string };
};

const BILLING_ROLES = ["agency_admin", "billing_manager"];

export default function BillingPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"queue" | "claims" | "authorisations">("queue");
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [serviceCode, setServiceCode] = useState("T1019");
  const [claimStatus, setClaimStatus] = useState("queued");
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authForm, setAuthForm] = useState({
    patientId: "",
    payerName: "",
    authorisationNumber: "",
    serviceCode: "",
    startDate: "",
    endDate: "",
    unitsAuthorised: "20",
    status: "active" as "active" | "pending",
  });

  const canBill = BILLING_ROLES.includes(user?.role || "");

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["billing-queue", orgId],
    queryFn: () => request<QueueItem[]>(`/api/orgs/{orgId}/billing/queue?pageSize=50`),
    enabled: !!orgId && canBill && tab === "queue",
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["billing-claims", orgId, claimStatus],
    queryFn: () =>
      request<Claim[]>(
        `/api/orgs/{orgId}/billing/claims?status=${claimStatus}&pageSize=50`,
      ),
    enabled: !!orgId && canBill && tab === "claims",
  });

  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["authorisations", orgId],
    queryFn: () =>
      request<Authorisation[]>(`/api/orgs/{orgId}/authorisations?pageSize=100`),
    enabled: !!orgId && canBill && tab === "authorisations",
  });

  const { data: patientsData } = useQuery({
    queryKey: ["patients", orgId, "billing"],
    queryFn: () =>
      request<{ id: string; fullName: string }[]>(
        `/api/orgs/{orgId}/patients?pageSize=200`,
      ),
    enabled: !!orgId && canBill && showAuthForm,
  });

  const queue = (queueData?.data as QueueItem[]) || [];
  const claims = (claimsData?.data as Claim[]) || [];
  const authorisations = (authData?.data as Authorisation[]) || [];
  const patients = (patientsData?.data as { id: string; fullName: string }[]) || [];
  const selectedQueue =
    queue.find((q) => q.id === selectedQueueId) ?? queue[0];

  const createClaimMutation = useMutation({
    mutationFn: (visitId: string) =>
      request(`/api/orgs/{orgId}/billing/claims`, {
        method: "POST",
        body: JSON.stringify({ visitId, serviceCode }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-queue"] });
      qc.invalidateQueries({ queryKey: ["billing-claims"] });
      setSelectedQueueId(null);
    },
  });

  const [payClaimId, setPayClaimId] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [paidAmount, setPaidAmount] = useState("");

  const updateClaimMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      status: string;
      paymentReference?: string;
      paidAmount?: number;
    }) =>
      request(`/api/orgs/{orgId}/billing/claims/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: payload.status,
          paymentReference: payload.paymentReference,
          paidAmount: payload.paidAmount,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-claims"] });
      setPayClaimId(null);
      setPaymentRef("");
      setPaidAmount("");
    },
  });

  const createAuthMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/{orgId}/authorisations`, {
        method: "POST",
        body: JSON.stringify({
          ...authForm,
          unitsAuthorised: Number.parseInt(authForm.unitsAuthorised, 10),
          startDate: new Date(`${authForm.startDate}T00:00:00`).toISOString(),
          endDate: new Date(`${authForm.endDate}T23:59:59`).toISOString(),
          serviceCode: authForm.serviceCode || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["authorisations"] });
      setShowAuthForm(false);
    },
  });

  const deleteAuthMutation = useMutation({
    mutationFn: (id: string) =>
      request(`/api/orgs/{orgId}/authorisations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authorisations"] }),
  });

  const submitBatchMutation = useMutation({
    mutationFn: () =>
      request<{ batch: { batchNumber: string; id: string }; exportCsv: string }>(
        `/api/orgs/{orgId}/billing/submissions`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    onSuccess: (res) => {
      const payload = res.data as { batch: { batchNumber: string }; exportCsv: string };
      if (payload?.exportCsv) {
        const blob = new Blob([payload.exportCsv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `837-${payload.batch.batchNumber}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      qc.invalidateQueries({ queryKey: ["billing-claims"] });
      setClaimStatus("submitted");
    },
  });

  if (!canBill) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Billing is limited to agency admins and billing managers.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-[#028090]" />
          Billing
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Turn approved visits into claims and manage payer authorisations.
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {(
          [
            ["queue", "Claim queue"],
            ["claims", "Claims"],
            ["authorisations", "Authorisations"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === key
                ? "bg-[#028090] text-white"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "queue" && (
        <>
          {queueLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-[#028090] mx-auto" />
          ) : queue.length === 0 ? (
            <p className="text-sm text-slate-500">No approved visits awaiting claims.</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              <ul className="space-y-2">
                {queue.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedQueueId(item.id)}
                      className={`w-full text-left rounded-xl border p-4 ${
                        (selectedQueueId ?? queue[0]?.id) === item.id
                          ? "border-[#028090] bg-teal-50/40"
                          : "border-slate-100 bg-white"
                      }`}
                    >
                      <p className="font-semibold">{item.patient.fullName}</p>
                      <p className="text-sm text-slate-600">
                        {item.visitLog.visitType} ·{" "}
                        {formatDateTime(item.visitLog.scheduledAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
              {selectedQueue && (
                <div className="bg-white border rounded-2xl p-6">
                  <h2 className="font-semibold mb-4">Create claim</h2>
                  <label className="block text-sm mb-4">
                    <span className="text-slate-600">Service code</span>
                    <input
                      value={serviceCode}
                      onChange={(e) => setServiceCode(e.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={createClaimMutation.isPending}
                    onClick={() =>
                      createClaimMutation.mutate(selectedQueue.visitLog.id)
                    }
                    className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
                  >
                    Queue claim
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "claims" && (
        <>
          {claimStatus === "queued" && claims.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3">
              <p className="text-sm text-slate-700 flex-1">
                Submit {claims.length} queued claim{claims.length === 1 ? "" : "s"} as an 837 batch to your clearinghouse.
              </p>
              <button
                type="button"
                disabled={submitBatchMutation.isPending}
                onClick={() => submitBatchMutation.mutate()}
                className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
              >
                {submitBatchMutation.isPending ? "Submitting…" : "Submit batch & download 837 CSV"}
              </button>
            </div>
          )}
          <div className="flex gap-2 mb-4">
            {(["queued", "submitted", "paid", "denied"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setClaimStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                  claimStatus === s
                    ? "bg-[#028090] text-white"
                    : "bg-white border text-slate-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {claimsLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-[#028090] mx-auto" />
          ) : (
            <ul className="space-y-2">
              {claims.map((claim) => (
                <li
                  key={claim.id}
                  className="bg-white border rounded-xl p-4 flex flex-wrap justify-between gap-2"
                >
                  <div>
                    <p className="font-semibold">
                      {claim.claimNumber || claim.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {claim.patient.fullName} · {claim.serviceCode} ·{" "}
                      {claim.payerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {claim.status === "queued" && (
                      <span className="text-xs text-slate-500 self-center">
                        Use batch submit above
                      </span>
                    )}
                    {claim.status === "submitted" && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayClaimId(claim.id);
                          setPaidAmount(String(claim.totalAmount ?? ""));
                        }}
                        className="text-sm text-emerald-700 font-medium"
                      >
                        Record payment
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {payClaimId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <form
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              updateClaimMutation.mutate({
                id: payClaimId,
                status: "paid",
                paymentReference: paymentRef || undefined,
                paidAmount: Number.parseFloat(paidAmount) || undefined,
              });
            }}
          >
            <h3 className="font-semibold text-slate-900">Record payment</h3>
            <label className="block text-sm">
              Payment reference
              <input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Check # or ERA id"
              />
            </label>
            <label className="block text-sm">
              Amount paid
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setPayClaimId(null)}
                className="px-3 py-2 text-sm border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateClaimMutation.isPending}
                className="px-3 py-2 text-sm bg-[#028090] text-white rounded-lg"
              >
                Mark paid
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "authorisations" && (
        <>
          <button
            type="button"
            onClick={() => setShowAuthForm((v) => !v)}
            className="mb-4 px-3 py-2 rounded-lg bg-[#028090] text-white text-sm"
          >
            {showAuthForm ? "Cancel" : "Add authorisation"}
          </button>
          {showAuthForm && (
            <form
              className="mb-6 bg-white border rounded-2xl p-6 grid sm:grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                createAuthMutation.mutate();
              }}
            >
              <label className="text-sm block">
                Patient
                <select
                  required
                  value={authForm.patientId}
                  onChange={(e) =>
                    setAuthForm((f) => ({ ...f, patientId: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm block">
                Payer
                <input
                  required
                  value={authForm.payerName}
                  onChange={(e) =>
                    setAuthForm((f) => ({ ...f, payerName: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="text-sm block">
                Auth #
                <input
                  required
                  value={authForm.authorisationNumber}
                  onChange={(e) =>
                    setAuthForm((f) => ({
                      ...f,
                      authorisationNumber: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="text-sm block">
                Service code
                <input
                  value={authForm.serviceCode}
                  onChange={(e) =>
                    setAuthForm((f) => ({ ...f, serviceCode: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="text-sm block">
                Start
                <input
                  type="date"
                  required
                  value={authForm.startDate}
                  onChange={(e) =>
                    setAuthForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="text-sm block">
                End
                <input
                  type="date"
                  required
                  value={authForm.endDate}
                  onChange={(e) =>
                    setAuthForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="text-sm block">
                Units
                <input
                  type="number"
                  required
                  min={1}
                  value={authForm.unitsAuthorised}
                  onChange={(e) =>
                    setAuthForm((f) => ({
                      ...f,
                      unitsAuthorised: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="sm:col-span-2 px-4 py-2 rounded-lg bg-[#028090] text-white text-sm"
              >
                Save authorisation
              </button>
            </form>
          )}
          {authLoading ? (
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#028090]" />
          ) : (
            <ul className="space-y-2">
              {authorisations.map((auth) => (
                <li
                  key={auth.id}
                  className="bg-white border rounded-xl p-4 flex justify-between gap-2"
                >
                  <div>
                    <p className="font-semibold">
                      {auth.patient.fullName} — {auth.payerName}
                    </p>
                    <p className="text-sm text-slate-600">
                      #{auth.authorisationNumber} · {auth.status} ·{" "}
                      {auth.unitsUsed}/{auth.unitsAuthorised} units
                    </p>
                    <Link
                      href={`/patients/${auth.patient.id}`}
                      className="text-xs text-[#028090]"
                    >
                      View patient
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAuthMutation.mutate(auth.id)}
                    className="text-sm text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
