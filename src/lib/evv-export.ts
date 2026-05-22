import type { VisitLog } from "@prisma/client";

export const EVV_EXPORT_HEADERS = [
  "visit_id",
  "patient_id",
  "patient_name",
  "staff_id",
  "staff_name",
  "visit_type",
  "visit_status",
  "scheduled_at",
  "checkin_at",
  "checkout_at",
  "duration_minutes",
  "service_address",
  "checkin_latitude",
  "checkin_longitude",
  "checkout_latitude",
  "checkout_longitude",
  "checkin_distance_meters",
  "checkout_distance_meters",
  "evv_verified",
  "evv_flag_reason",
  "submitted_at",
] as const;

export type EvvExportRow = {
  visit: Pick<
    VisitLog,
    | "id"
    | "patientId"
    | "loggedById"
    | "visitType"
    | "status"
    | "scheduledAt"
    | "checkinAt"
    | "checkoutAt"
    | "durationMinutes"
    | "serviceAddress"
    | "checkinLatitude"
    | "checkinLongitude"
    | "checkoutLatitude"
    | "checkoutLongitude"
    | "checkinDistanceMeters"
    | "checkoutDistanceMeters"
    | "evvVerified"
    | "evvFlagReason"
    | "submittedAt"
  >;
  patient: { fullName: string };
  staff: { fullName: string };
};

function csvEscape(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : "";
}

export function evvRowToCsvLine(row: EvvExportRow) {
  const { visit, patient, staff } = row;
  return [
    visit.id,
    visit.patientId,
    patient.fullName,
    visit.loggedById,
    staff.fullName,
    visit.visitType,
    visit.status,
    iso(visit.scheduledAt),
    iso(visit.checkinAt),
    iso(visit.checkoutAt),
    visit.durationMinutes ?? "",
    visit.serviceAddress ?? "",
    visit.checkinLatitude ?? "",
    visit.checkinLongitude ?? "",
    visit.checkoutLatitude ?? "",
    visit.checkoutLongitude,
    visit.checkinDistanceMeters ?? "",
    visit.checkoutDistanceMeters ?? "",
    visit.evvVerified,
    visit.evvFlagReason ?? "",
    iso(visit.submittedAt),
  ]
    .map(csvEscape)
    .join(",");
}

export function buildEvvExportCsv(rows: EvvExportRow[]) {
  const header = EVV_EXPORT_HEADERS.join(",");
  const body = rows.map(evvRowToCsvLine).join("\n");
  return `${header}\n${body}\n`;
}
