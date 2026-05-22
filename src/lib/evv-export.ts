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

export type EvvExportVisitRow = {
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
  patient: {
    id: string;
    fullName: string;
    insuranceNumber?: string | null;
    medicaidMemberId?: string | null;
  };
  staff: { fullName: string };
};

/** @deprecated Use EvvExportVisitRow */
export type EvvExportRow = EvvExportVisitRow;

export type EvvExportContext = {
  orgId: string;
  orgNpi?: string | null;
  orgRegion?: string | null;
};

export type EvvExportFilters = {
  startDate?: string | null;
  endDate?: string | null;
  verifiedOnly?: boolean;
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

export function evvRowToCsvLine(row: EvvExportVisitRow) {
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

export function buildEvvExportCsv(rows: EvvExportVisitRow[]) {
  const header = EVV_EXPORT_HEADERS.join(",");
  const body = rows.map(evvRowToCsvLine).join("\n");
  return `${header}\n${body}\n`;
}

export async function fetchEvvExportRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { visitLog: { findMany: (args: object) => Promise<any[]> } },
  orgId: string,
  filters: EvvExportFilters,
): Promise<EvvExportVisitRow[]> {
  const scheduledAt: { gte?: Date; lte?: Date } = {};
  if (filters.startDate) scheduledAt.gte = new Date(filters.startDate);
  if (filters.endDate) scheduledAt.lte = new Date(`${filters.endDate}T23:59:59Z`);

  const verifiedOnly = filters.verifiedOnly !== false;

  const visits = await prisma.visitLog.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: { in: ["completed", "in_progress"] },
      checkinAt: { not: null },
      ...(verifiedOnly && { evvVerified: true }),
      ...(Object.keys(scheduledAt).length ? { scheduledAt } : {}),
    },
    orderBy: { scheduledAt: "asc" },
    take: 5000,
    include: {
      patient: {
        select: { id: true, fullName: true, insuranceNumber: true },
      },
      loggedBy: { select: { fullName: true } },
    },
  });

  return visits.map((v) => ({
    visit: v,
    patient: {
      id: v.patient.id,
      fullName: v.patient.fullName,
      insuranceNumber: v.patient.insuranceNumber,
    },
    staff: v.loggedBy,
  }));
}
