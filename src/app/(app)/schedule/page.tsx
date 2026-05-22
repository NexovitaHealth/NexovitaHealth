"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Loader2,
  Plus,
  Download,
  Pencil,
} from "lucide-react";
import {
  VisitScheduleModal,
  type ScheduleVisit,
} from "@/components/schedule/VisitScheduleModal";
import { VISIT_TYPES } from "@/components/schedule/visit-types";
import { formatDateTime } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  missed: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function visitTypeLabel(value: string) {
  return (
    VISIT_TYPES.find((t) => t.value === value)?.label ??
    value.replace(/_/g, " ")
  );
}

export default function SchedulePage() {
  const { request, orgId } = useApi();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingVisit, setEditingVisit] = useState<ScheduleVisit | null>(null);

  const startDate = new Date(viewYear, viewMonth, 1).toISOString().slice(0, 10);
  const endDate = new Date(viewYear, viewMonth + 1, 0)
    .toISOString()
    .slice(0, 10);

  const selectedDateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

  const { data, isLoading } = useQuery({
    queryKey: ["schedule", orgId, startDate, endDate],
    queryFn: () =>
      request<ScheduleVisit[]>(
        `/api/orgs/{orgId}/schedule?startDate=${startDate}&endDate=${endDate}`,
      ),
    enabled: !!orgId,
  });

  const visits = (data?.data ?? []) as ScheduleVisit[];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const getVisitsForDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return visits.filter((v) => v.scheduledAt?.slice(0, 10) === dateStr);
  };

  const selectedDateVisits = getVisitsForDay(selectedDay);

  const openCreate = () => {
    setEditingVisit(null);
    setModalMode("create");
  };

  const openEdit = (visit: ScheduleVisit) => {
    setEditingVisit(visit);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingVisit(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#028090]" /> Schedule
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visit calendar and care schedules
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!orgId) return;
              const start = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
              const endDay = getDaysInMonth(viewYear, viewMonth);
              const end = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
              window.location.href = `/api/orgs/${orgId}/visits/evv-export?startDate=${start}&endDate=${end}`;
            }}
            className="flex items-center gap-2 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> EVV export
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#028090] hover:bg-[#026f7c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Schedule visit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-slate-900">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-semibold text-slate-400 py-1"
              >
                {d}
              </div>
            ))}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (day) => {
                  const dayVisits = getVisitsForDay(day);
                  const isToday =
                    viewYear === now.getFullYear() &&
                    viewMonth === now.getMonth() &&
                    day === now.getDate();
                  const isSelected = day === selectedDay;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`relative aspect-square flex flex-col items-center justify-start pt-1.5 rounded-xl transition-colors text-sm font-medium border ${
                        isSelected
                          ? "bg-[#028090] text-white border-[#028090]"
                          : isToday
                            ? "bg-teal-50 text-teal-800 border-teal-200"
                            : "hover:bg-slate-50 text-slate-700 border-transparent hover:border-slate-200"
                      }`}
                    >
                      {day}
                      {dayVisits.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayVisits.slice(0, 3).map((v) => (
                            <div
                              key={v.id}
                              className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/70" : "bg-[#028090]"}`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#028090]" /> Scheduled
              visits
            </span>
            <span>{visits.length} visits this month</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              {MONTHS[viewMonth]} {selectedDay}, {viewYear}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {selectedDateVisits.length} visit
                {selectedDateVisits.length !== 1 ? "s" : ""}
              </span>
            </h3>
            <button
              type="button"
              onClick={openCreate}
              className="text-xs font-medium text-[#028090] hover:underline"
            >
              + Add
            </button>
          </div>
          {selectedDateVisits.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-200" />
              <p className="text-sm">No visits scheduled</p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-3 text-sm text-[#028090] font-medium"
              >
                Schedule a visit
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateVisits.map((visit) => (
                <button
                  key={visit.id}
                  type="button"
                  onClick={() => openEdit(visit)}
                  className={`w-full text-left rounded-xl border px-3.5 py-3 transition-shadow hover:shadow-sm ${STATUS_STYLES[visit.status] || "bg-slate-50 text-slate-700 border-slate-200"}`}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <p className="text-sm font-semibold">
                      {visitTypeLabel(visit.visitType)}
                    </p>
                    <span className="flex items-center gap-1 text-xs font-medium capitalize opacity-80">
                      {visit.status}
                      <Pencil className="w-3 h-3" />
                    </span>
                  </div>
                  {visit.patient && (
                    <p className="text-xs flex items-center gap-1 opacity-80">
                      <User className="w-3 h-3" />
                      {visit.patient.fullName}
                    </p>
                  )}
                  {visit.scheduledAt && (
                    <p className="text-xs flex items-center gap-1 mt-1 opacity-80">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(visit.scheduledAt)}
                    </p>
                  )}
                  {visit.caregiver && (
                    <p className="text-xs mt-1 opacity-80">
                      Aide: {visit.caregiver.fullName}
                    </p>
                  )}
                  {visit.serviceAddress && (
                    <p className="text-xs flex items-center gap-1 mt-1 opacity-80 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {visit.serviceAddress}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalMode && orgId && (
        <VisitScheduleModal
          mode={modalMode}
          orgId={orgId}
          defaultDate={modalMode === "create" ? selectedDateStr : undefined}
          visit={modalMode === "edit" ? editingVisit ?? undefined : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
