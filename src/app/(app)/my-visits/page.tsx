"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/utils";
import {
  CalendarCheck,
  Loader2,
  MapPin,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

type VisitTask = {
  id: string;
  title: string;
  status: string;
  required: boolean;
  instructions?: string;
};

type Visit = {
  id: string;
  status: string;
  visitType: string;
  scheduledAt: string;
  checkinAt?: string;
  checkoutAt?: string;
  notes?: string;
  evvVerified: boolean;
  evvFlagReason?: string;
  lockedAt?: string;
  submittedAt?: string;
  serviceAddress?: string;
  patient: { id: string; fullName: string; address?: string };
  visitTasks: VisitTask[];
};

const FIELD_ROLES = ["aide", "school_nurse"];

function todayRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
    });
  });
}

const statusLabel: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Checked out",
  missed: "Missed",
  cancelled: "Cancelled",
};

export default function MyVisitsPage() {
  const { request, orgId } = useApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const canUse = FIELD_ROLES.includes(user?.role || "");
  const range = todayRange();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-visits", orgId, user?.id, range.startDate],
    queryFn: () =>
      request<Visit[]>(
        `/api/orgs/{orgId}/visits?staffId=${user?.id}&startDate=${range.startDate}&endDate=${range.endDate}&pageSize=50`,
      ),
    enabled: !!orgId && !!user?.id && canUse,
  });

  const visits = (data?.data as Visit[]) || [];
  const selected = visits.find((v) => v.id === selectedId) ?? visits[0];

  const refreshVisit = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["my-visits"] });
  }, [qc]);

  const withGeo = useCallback(
    async (
      action: (coords: {
        latitude: number;
        longitude: number;
      }) => Promise<unknown>,
    ) => {
      setGeoError(null);
      setLoadingGeo(true);
      try {
        const pos = await getPosition();
        await action({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        refreshVisit();
      } catch (err) {
        setGeoError(
          err instanceof Error ? err.message : "Could not get GPS location",
        );
      } finally {
        setLoadingGeo(false);
      }
    },
    [refreshVisit],
  );

  const checkInMutation = useMutation({
    mutationFn: (visitId: string) =>
      withGeo(async (coords) => {
        await request(`/api/orgs/{orgId}/visits/${visitId}/check-in`, {
          method: "POST",
          body: JSON.stringify(coords),
        });
      }),
  });

  const checkOutMutation = useMutation({
    mutationFn: (visitId: string) =>
      withGeo(async (coords) => {
        await request(`/api/orgs/{orgId}/visits/${visitId}/check-out`, {
          method: "POST",
          body: JSON.stringify({ ...coords, notes: notes || undefined }),
        });
      }),
  });

  const submitMutation = useMutation({
    mutationFn: (visitId: string) =>
      request(`/api/orgs/{orgId}/visits/${visitId}/submit`, { method: "POST" }),
    onSuccess: refreshVisit,
  });

  const taskMutation = useMutation({
    mutationFn: (payload: {
      visitId: string;
      taskId: string;
      status: "completed" | "skipped";
    }) =>
      request(
        `/api/orgs/{orgId}/visits/${payload.visitId}/tasks/${payload.taskId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: payload.status }),
        },
      ),
    onSuccess: refreshVisit,
  });

  const pending = visits.filter((v) =>
    ["scheduled", "in_progress", "completed"].includes(v.status),
  );

  if (!canUse) {
    return (
      <div className="p-8 text-sm text-slate-500">
        My Visits is for field staff (aides and school nurses).
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-[#028090]" />
            My visits today
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Check in with GPS, complete tasks, check out, and submit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm text-[#028090] font-medium"
        >
          Refresh
        </button>
      </div>

      {geoError && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
          {geoError}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#028090]" />
        </div>
      ) : pending.length === 0 ? (
        <p className="text-sm text-slate-500">No visits assigned for today.</p>
      ) : (
        <>
          <ul className="space-y-2 mb-6">
            {visits.map((visit) => (
              <li key={visit.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(visit.id);
                    setNotes(visit.notes || "");
                  }}
                  className={`w-full text-left rounded-xl border p-4 ${
                    (selectedId ?? visits[0]?.id) === visit.id
                      ? "border-[#028090] bg-teal-50/40"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <p className="font-semibold text-slate-900">
                    {visit.patient.fullName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {visit.visitType} · {formatDateTime(visit.scheduledAt)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 capitalize">
                    {statusLabel[visit.status] || visit.status}
                    {visit.submittedAt ? " · submitted" : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-lg">{selected.patient.fullName}</h2>
                <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selected.serviceAddress ||
                    selected.patient.address ||
                    "Address on file"}
                </p>
              </div>

              {selected.status === "scheduled" && !selected.lockedAt && (
                <button
                  type="button"
                  disabled={loadingGeo || checkInMutation.isPending}
                  onClick={() => checkInMutation.mutate(selected.id)}
                  className="w-full py-3 rounded-xl bg-[#028090] text-white font-medium flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Check in (GPS)
                </button>
              )}

              {selected.status === "in_progress" && (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 flex items-center gap-1 mb-2">
                      <ClipboardList className="w-4 h-4" />
                      Visit tasks
                    </h3>
                    <ul className="space-y-2">
                      {selected.visitTasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex items-center justify-between gap-2 text-sm border rounded-lg p-3"
                        >
                          <span>
                            {task.title}
                            {task.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </span>
                          {task.status !== "completed" ? (
                            <button
                              type="button"
                              onClick={() =>
                                taskMutation.mutate({
                                  visitId: selected.id,
                                  taskId: task.id,
                                  status: "completed",
                                })
                              }
                              className="text-[#028090] font-medium shrink-0"
                            >
                              Done
                            </button>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <label className="block text-sm">
                    <span className="text-slate-600">Visit notes</span>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={loadingGeo || checkOutMutation.isPending}
                    onClick={() => checkOutMutation.mutate(selected.id)}
                    className="w-full py-3 rounded-xl border-2 border-[#028090] text-[#028090] font-medium"
                  >
                    Check out (GPS)
                  </button>
                </>
              )}

              {selected.status === "completed" &&
                !selected.submittedAt &&
                !selected.lockedAt && (
                  <button
                    type="button"
                    disabled={submitMutation.isPending}
                    onClick={() => submitMutation.mutate(selected.id)}
                    className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium"
                  >
                    Submit visit for review
                  </button>
                )}

              {selected.submittedAt && (
                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  Submitted {formatDateTime(selected.submittedAt)} — awaiting nurse
                  review.
                </p>
              )}

              {selected.evvFlagReason && (
                <p className="text-xs text-amber-700">
                  EVV flag: {selected.evvFlagReason}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
