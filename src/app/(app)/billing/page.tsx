"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { DollarSign, Loader2, Upload, Server } from "lucide-react";

type SubmissionBatch = {
  id: string;
  batchNumber: string;
  claimCount: number;
  totalAmount: number;
  status: string;
  transportMode?: string | null;
  transportStatus?: string | null;
  transportMessage?: string | null;
  clearinghouseRef?: string | null;
  transmittedAt?: string | null;
  submittedAt: string;
  submittedBy: { fullName: string };
};

type ClearinghouseSettings = {
  enabled: boolean;
  transport: "file" | "sftp" | "http";
  sftp?: {
    host: string;
    port: number;
    username: string;
    remotePath: string;
    passwordEnvVar: string;
    passwordConfigured?: boolean;
  };
  http?: {
    submitUrl: string;
    apiKeyEnvVar: string;
    timeoutMs: number;
    apiKeyConfigured?: boolean;
  };
};

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [tab, setTab] = useState<
    "queue" | "claims" | "submissions" | "clearinghouse" | "authorisations"
  >("queue");
  const [submitTransport, setSubmitTransport] = useState<
    "file" | "sftp" | "http"
  >("file");
  const [transportNotice, setTransportNotice] = useState<string | null>(null);
  const [chForm, setChForm] = useState<ClearinghouseSettings>({
    enabled: false,
    transport: "file",
    sftp: {
      host: "",
      port: 22,
      username: "",
      remotePath: "/incoming",
      passwordEnvVar: "CLEARINGHOUSE_SFTP_PASSWORD",
    },
    http: {
      submitUrl: "",
      apiKeyEnvVar: "CLEARINGHOUSE_API_KEY",
      timeoutMs: 30000,
    },
  });
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

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ["billing-submissions", orgId],
    queryFn: () =>
      request<SubmissionBatch[]>(
        `/api/orgs/{orgId}/billing/submissions?pageSize=30`,
      ),
    enabled: !!orgId && canBill && tab === "submissions",
  });

  const { data: chData } = useQuery({
    queryKey: ["clearinghouse-settings", orgId],
    queryFn: () =>
      request<{ clearinghouse: ClearinghouseSettings }>(
        `/api/orgs/{orgId}/billing/clearinghouse`,
      ),
    enabled: !!orgId && canBill,
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
  const submissions =
    (submissionsData?.data as SubmissionBatch[]) || [];

  const chSettings = (chData?.data as { clearinghouse?: ClearinghouseSettings })
    ?.clearinghouse;

  useEffect(() => {
    if (!chSettings) return;
    setChForm((prev) => ({
      ...prev,
      ...chSettings,
      sftp: { ...prev.sftp!, ...chSettings.sftp },
      http: { ...prev.http!, ...chSettings.http },
    }));
    if (chSettings.enabled) setSubmitTransport(chSettings.transport);
  }, [chSettings]);
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
      request<{
        batch: { batchNumber: string };
        exportCsv: string;
        transportError?: string;
        transportResult?: { message: string };
      }>(`/api/orgs/{orgId}/billing/submissions`, {
        method: "POST",
        body: JSON.stringify({ transport: submitTransport }),
      }),
    onSuccess: (res) => {
      const payload = res.data;
      if (payload?.exportCsv && payload.batch) {
        downloadCsv(payload.exportCsv, `837-${payload.batch.batchNumber}.csv`);
      }
      if (payload?.transportError) {
        setTransportNotice(
          `Batch saved but clearinghouse transmit failed: ${payload.transportError}`,
        );
      } else if (payload?.transportResult?.message) {
        setTransportNotice(payload.transportResult.message);
      } else {
        setTransportNotice(null);
      }
      qc.invalidateQueries({ queryKey: ["billing-claims"] });
      qc.invalidateQueries({ queryKey: ["billing-submissions"] });
      setClaimStatus("submitted");
    },
  });

  const saveChMutation = useMutation({
    mutationFn: () =>
      request(`/api/orgs/{orgId}/billing/clearinghouse`, {
        method: "PATCH",
        body: JSON.stringify({ clearinghouse: chForm }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clearinghouse-settings"] });
    },
  });

  const testChMutation = useMutation({
    mutationFn: (transport: "sftp" | "http") =>
      request<{ ok: boolean; message: string }>(
        `/api/orgs/{orgId}/billing/clearinghouse/test`,
        { method: "POST", body: JSON.stringify({ transport }) },
      ),
    onSuccess: (res) => {
      const msg = (res.data as { message?: string })?.message;
      setTransportNotice(msg ?? "Connection test succeeded");
    },
    onError: (err: Error) => setTransportNotice(err.message),
  });

  const retryTransmitMutation = useMutation({
    mutationFn: (batchId: string) =>
      request<{ exportCsv: string; batch: { batchNumber: string } }>(
        `/api/orgs/{orgId}/billing/submissions/${batchId}/transmit`,
        { method: "POST", body: JSON.stringify({}) },
      ),
    onSuccess: (res) => {
      const payload = res.data;
      if (payload?.exportCsv && payload.batch) {
        downloadCsv(payload.exportCsv, `837-${payload.batch.batchNumber}.csv`);
      }
      qc.invalidateQueries({ queryKey: ["billing-submissions"] });
      setTransportNotice("Batch re-transmitted to clearinghouse");
    },
    onError: (err: Error) => setTransportNotice(err.message),
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
            ["submissions", "Submissions"],
            ["clearinghouse", "Clearinghouse"],
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
          {transportNotice && (
            <p className="mb-4 text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-900 border border-amber-100">
              {transportNotice}
            </p>
          )}
          {claimStatus === "queued" && claims.length > 0 && (
            <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3 space-y-3">
              <p className="text-sm text-slate-700">
                Submit {claims.length} queued claim{claims.length === 1 ? "" : "s"} as an 837 batch.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Transport:</span>
                {(["file", "sftp", "http"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSubmitTransport(t)}
                    className={`px-2.5 py-1 rounded text-xs font-medium uppercase ${
                      submitTransport === t
                        ? "bg-[#028090] text-white"
                        : "bg-white border text-slate-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={submitBatchMutation.isPending}
                onClick={() => submitBatchMutation.mutate()}
                className="px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium disabled:opacity-50"
              >
                {submitBatchMutation.isPending
                  ? "Submitting…"
                  : submitTransport === "file"
                    ? "Submit batch & download 837 CSV"
                    : `Submit & transmit via ${submitTransport.toUpperCase()}`}
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

      {tab === "submissions" && (
        <>
          {submissionsLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-[#028090] mx-auto" />
          ) : submissions.length === 0 ? (
            <p className="text-sm text-slate-500">No submission batches yet.</p>
          ) : (
            <ul className="space-y-2">
              {submissions.map((batch) => (
                <li
                  key={batch.id}
                  className="bg-white border rounded-xl p-4 flex flex-wrap justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold">{batch.batchNumber}</p>
                    <p className="text-sm text-slate-600">
                      {batch.claimCount} claims · $
                      {Number(batch.totalAmount).toFixed(2)} ·{" "}
                      {batch.submittedBy.fullName}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDateTime(batch.submittedAt)}
                      {batch.clearinghouseRef &&
                        ` · Ref ${batch.clearinghouseRef}`}
                    </p>
                    {batch.transportStatus && (
                      <p className="text-xs mt-1 capitalize">
                        <span
                          className={
                            batch.transportStatus === "transmitted"
                              ? "text-emerald-700"
                              : batch.transportStatus === "failed"
                                ? "text-red-600"
                                : "text-slate-500"
                          }
                        >
                          {batch.transportMode ?? "file"} ·{" "}
                          {batch.transportStatus.replace(/_/g, " ")}
                        </span>
                        {batch.transportMessage && (
                          <span className="text-slate-500">
                            {" "}
                            — {batch.transportMessage}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 self-center">
                    <a
                      href={`/api/orgs/${orgId}/billing/submissions/${batch.id}/export`}
                      className="text-sm text-[#028090] font-medium"
                    >
                      Download CSV
                    </a>
                    {batch.transportStatus === "failed" && (
                      <button
                        type="button"
                        onClick={() => retryTransmitMutation.mutate(batch.id)}
                        className="text-sm text-amber-700 font-medium"
                      >
                        Retry transmit
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "clearinghouse" && (
        <div className="max-w-xl space-y-4 card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-5 h-5 text-[#028090]" />
            <h2 className="font-semibold text-slate-900">Clearinghouse transport</h2>
          </div>
          <p className="text-sm text-slate-500">
            Credentials are read from server environment variables (never stored in
            the database). Configure SFTP drop or HTTP API submission for live 837
            transport.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={chForm.enabled}
              onChange={(e) =>
                setChForm((f) => ({ ...f, enabled: e.target.checked }))
              }
            />
            Enable live clearinghouse transport
          </label>
          <label className="block text-sm">
            Default transport
            <select
              value={chForm.transport}
              onChange={(e) =>
                setChForm((f) => ({
                  ...f,
                  transport: e.target.value as ClearinghouseSettings["transport"],
                }))
              }
              className="mt-1 w-full border rounded-lg px-3 py-2"
            >
              <option value="file">File only (manual upload)</option>
              <option value="sftp">SFTP</option>
              <option value="http">HTTP API</option>
            </select>
          </label>
          {(chForm.transport === "sftp" || chForm.enabled) && (
            <fieldset className="space-y-3 border-t pt-4">
              <legend className="text-sm font-medium text-slate-700">SFTP</legend>
              <input
                placeholder="Host"
                value={chForm.sftp?.host ?? ""}
                onChange={(e) =>
                  setChForm((f) => ({
                    ...f,
                    sftp: { ...f.sftp!, host: e.target.value },
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Port"
                  value={chForm.sftp?.port ?? 22}
                  onChange={(e) =>
                    setChForm((f) => ({
                      ...f,
                      sftp: { ...f.sftp!, port: Number(e.target.value) },
                    }))
                  }
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  placeholder="Username"
                  value={chForm.sftp?.username ?? ""}
                  onChange={(e) =>
                    setChForm((f) => ({
                      ...f,
                      sftp: { ...f.sftp!, username: e.target.value },
                    }))
                  }
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <input
                placeholder="Remote path"
                value={chForm.sftp?.remotePath ?? "/incoming"}
                onChange={(e) =>
                  setChForm((f) => ({
                    ...f,
                    sftp: { ...f.sftp!, remotePath: e.target.value },
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Password env var"
                value={chForm.sftp?.passwordEnvVar ?? "CLEARINGHOUSE_SFTP_PASSWORD"}
                onChange={(e) =>
                  setChForm((f) => ({
                    ...f,
                    sftp: { ...f.sftp!, passwordEnvVar: e.target.value },
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {chForm.sftp?.passwordConfigured === false && (
                <p className="text-xs text-amber-700">Password env var not set on server</p>
              )}
              <button
                type="button"
                onClick={() => testChMutation.mutate("sftp")}
                className="text-sm text-[#028090] font-medium"
              >
                Test SFTP connection
              </button>
            </fieldset>
          )}
          {(chForm.transport === "http" || chForm.enabled) && (
            <fieldset className="space-y-3 border-t pt-4">
              <legend className="text-sm font-medium text-slate-700">HTTP API</legend>
              <input
                placeholder="Submit URL"
                value={chForm.http?.submitUrl ?? ""}
                onChange={(e) =>
                  setChForm((f) => ({
                    ...f,
                    http: { ...f.http!, submitUrl: e.target.value },
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="API key env var"
                value={chForm.http?.apiKeyEnvVar ?? "CLEARINGHOUSE_API_KEY"}
                onChange={(e) =>
                  setChForm((f) => ({
                    ...f,
                    http: { ...f.http!, apiKeyEnvVar: e.target.value },
                  }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => testChMutation.mutate("http")}
                className="text-sm text-[#028090] font-medium"
              >
                Test HTTP endpoint
              </button>
            </fieldset>
          )}
          <button
            type="button"
            onClick={() => saveChMutation.mutate()}
            disabled={saveChMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#028090] text-white text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            {saveChMutation.isPending ? "Saving…" : "Save clearinghouse settings"}
          </button>
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
