import type { MedicaidEvvConfig } from "@/lib/evv-medicaid/config";
import type { EvvExportContext, EvvExportVisitRow } from "@/lib/evv-export";

/** Sandata-aligned visit export columns (common Medicaid EVV aggregator import). */
export const MEDICAID_EVV_HEADERS = [
  "Provider_ID",
  "Provider_NPI",
  "Office_ID",
  "Payer_ID",
  "State_Code",
  "Member_Medicaid_ID",
  "Member_First_Name",
  "Member_Last_Name",
  "Caregiver_ID",
  "Caregiver_First_Name",
  "Caregiver_Last_Name",
  "Service_Code",
  "Visit_Date",
  "Schedule_Start_Time",
  "Schedule_End_Time",
  "Visit_Start_Time",
  "Visit_End_Time",
  "Visit_Start_Address",
  "Visit_End_Address",
  "Visit_Start_Latitude",
  "Visit_Start_Longitude",
  "Visit_End_Latitude",
  "Visit_End_Longitude",
  "Visit_Status",
  "EVV_Compliant",
  "Exception_Code",
  "Nexovita_Visit_ID",
] as const;

const VISIT_TYPE_SERVICE_CODES: Record<string, string> = {
  skilled_nursing: "G0299",
  home_health_aide: "S5135",
  personal_care: "T1019",
  therapy: "G0151",
  hospice: "G0299",
  respite: "S5150",
};

function csvEscape(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] ?? "",
    last: parts.slice(1).join(" ") || parts[0] || "",
  };
}

function formatEvvTimestamp(d: Date | null | undefined, timezone: string) {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(d)
      .replace(",", "");
  } catch {
    return d.toISOString().replace("T", " ").slice(0, 19);
  }
}

function formatVisitDate(d: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function resolveServiceCode(visitType: string, defaultCode: string) {
  const key = visitType.toLowerCase().replace(/\s+/g, "_");
  return VISIT_TYPE_SERVICE_CODES[key] ?? defaultCode;
}

function mapVisitStatus(status: string) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "InProgress";
  if (status === "missed") return "Missed";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function medicaidEvvRowToCsvLine(
  row: EvvExportVisitRow,
  config: MedicaidEvvConfig,
  context: EvvExportContext,
) {
  const { visit, patient, staff } = row;
  const member = splitName(patient.fullName);
  const caregiver = splitName(staff.fullName);
  const providerId =
    config.medicaidProviderId.trim() || context.orgNpi || context.orgId.slice(0, 12);

  const scheduleEnd =
    visit.checkoutAt ??
    (visit.durationMinutes && visit.checkinAt
      ? new Date(visit.checkinAt.getTime() + visit.durationMinutes * 60_000)
      : null);

  return [
    providerId,
    context.orgNpi ?? "",
    config.officeId || context.orgId.slice(0, 8),
    config.payerId,
    config.stateCode || (context.orgRegion?.slice(0, 2) ?? ""),
    patient.medicaidMemberId || patient.insuranceNumber || patient.id,
    member.first,
    member.last,
    visit.loggedById,
    caregiver.first,
    caregiver.last,
    resolveServiceCode(visit.visitType, config.defaultServiceCode),
    formatVisitDate(visit.scheduledAt, config.timezone),
    formatEvvTimestamp(visit.scheduledAt, config.timezone),
    formatEvvTimestamp(scheduleEnd, config.timezone),
    formatEvvTimestamp(visit.checkinAt, config.timezone),
    formatEvvTimestamp(visit.checkoutAt, config.timezone),
    visit.serviceAddress ?? "",
    visit.serviceAddress ?? "",
    visit.checkinLatitude ?? "",
    visit.checkinLongitude ?? "",
    visit.checkoutLatitude ?? "",
    visit.checkoutLongitude ?? "",
    mapVisitStatus(visit.status),
    visit.evvVerified ? "Y" : "N",
    visit.evvFlagReason ?? "",
    visit.id,
  ]
    .map(csvEscape)
    .join(",");
}

export function buildMedicaidEvvCsv(
  rows: EvvExportVisitRow[],
  config: MedicaidEvvConfig,
  context: EvvExportContext,
) {
  const header = MEDICAID_EVV_HEADERS.join(",");
  const body = rows.map((r) => medicaidEvvRowToCsvLine(r, config, context)).join("\n");
  return `${header}\n${body}\n`;
}
