"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import { ClipboardCheck, Loader2 } from "lucide-react";

type VisitReview = {
  id: string;
  status: string;
  createdAt: string;
  patient: { fullName: string };
  visitLog: {
    id: string;
    visitType: string;
    scheduledAt: string;
    submittedAt?: string;
    evvVerified: boolean;
    notes?: string;
    loggedBy?: { fullName: string };
  };
};

export default function VisitReviewPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const canReview = ["agency_admin", "supervisor", "physician"].includes(
    user?.role || "",
  );

  const { data, isLoading } = useQuery({
    queryKey: ["visit-reviews", orgId, statusFilter],
    queryFn: () =>
      request<VisitReview[]>(
        `/api/orgs/{orgId}/review/visits?status=${statusFilter}`,
      ),
    enabled: !!orgId && canReview,
  });

  const reviews = (data?.data as VisitReview[]) || [];
  const selected = reviews.find((r) => r.id === selectedId) ?? reviews[0];

  const decideMutation = useMutation({
    mutationFn: (payload: {
      visitId: string;
      status: "approved" | "needs_correction" | "rejected";
    }) =>
      request(`/api/orgs/{orgId}/review/visits/${payload.visitId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: payload.status,
          clinicalNotes: notes || undefined,
          correctionReason:
            payload.status !== "approved" ? correctionReason : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visit-reviews"] });
      setNotes("");
      setCorrectionReason("");
      setSelectedId(null);
    },
  });

  if (!canReview) {
    return (
      <div className="p-8 text-sm text-slate-500">
        Visit review is limited to clinical reviewers (admin, supervisor, physician).
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-[#028090]" />
          Visit review queue
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Approve submitted visits before they enter the billing queue.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {(["pending", "approved", "needs_correction", "rejected"] as const).map(
          (s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                statusFilter === s
                  ? "bg-[#028090] text-white"
                  : "bg-white border border-slate-200 text-slate-600"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ),
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate-500">No visits in this queue.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <ul className="space-y-2">
            {reviews.map((review) => (
              <li key={review.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(review.id)}
                  className={`w-full text-left rounded-xl border p-4 ${
                    (selectedId ?? reviews[0]?.id) === review.id
                      ? "border-[#028090] bg-teal-50/40"
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="font-semibold text-slate-900">
                    {review.patient.fullName}
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {review.visitLog.visitType} ·{" "}
                    {formatDateTime(review.visitLog.scheduledAt)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 capitalize">
                    {review.status} · EVV{" "}
                    {review.visitLog.evvVerified ? "verified" : "flagged"}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Review visit</h2>
              <dl className="text-sm space-y-2 mb-4">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Aide</dt>
                  <dd>{selected.visitLog.loggedBy?.fullName || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Submitted</dt>
                  <dd>
                    {selected.visitLog.submittedAt
                      ? formatDateTime(selected.visitLog.submittedAt)
                      : "—"}
                  </dd>
                </div>
              </dl>
              {selected.visitLog.notes && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-4">
                  {selected.visitLog.notes}
                </p>
              )}
              {statusFilter === "pending" && (
                <>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Clinical notes (optional)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 min-h-[72px]"
                  />
                  <textarea
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Correction reason (required if sending back or rejecting)"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 min-h-[72px]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={decideMutation.isPending}
                      onClick={() =>
                        decideMutation.mutate({
                          visitId: selected.visitLog.id,
                          status: "approved",
                        })
                      }
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={decideMutation.isPending || !correctionReason.trim()}
                      onClick={() =>
                        decideMutation.mutate({
                          visitId: selected.visitLog.id,
                          status: "needs_correction",
                        })
                      }
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium disabled:opacity-50"
                    >
                      Send back
                    </button>
                    <button
                      type="button"
                      disabled={decideMutation.isPending || !correctionReason.trim()}
                      onClick={() =>
                        decideMutation.mutate({
                          visitId: selected.visitLog.id,
                          status: "rejected",
                        })
                      }
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
