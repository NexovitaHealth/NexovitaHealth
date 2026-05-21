import type { Prisma, VisitLog, VisitTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_EVV_RADIUS_METERS = 250;

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export function haversineDistanceMeters(a: Coordinates, b: Coordinates) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

export function evaluateEvv(
  actual: Coordinates,
  expected?: Coordinates | null,
  radiusMeters = DEFAULT_EVV_RADIUS_METERS,
) {
  if (!expected) {
    return {
      verified: false,
      distanceMeters: null,
      flagReason: "service_location_missing",
    };
  }

  const distanceMeters = Math.round(haversineDistanceMeters(actual, expected));
  return {
    verified: distanceMeters <= radiusMeters,
    distanceMeters,
    flagReason:
      distanceMeters <= radiusMeters
        ? null
        : `outside_radius:${distanceMeters}m>${radiusMeters}m`,
  };
}

export async function getOrgPatientOrThrow(
  orgId: string,
  patientId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const patient = await client.patient.findFirst({
    where: { id: patientId, orgId, deletedAt: null },
    select: {
      id: true,
      orgId: true,
      fullName: true,
      address: true,
      latitude: true,
      longitude: true,
    },
  });
  if (!patient) throw new Error("PATIENT_NOT_FOUND");
  return patient;
}

export async function ensureOrgMember(
  orgId: string,
  userId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const membership = await client.orgMembership.findFirst({
    where: { orgId, userId },
    select: { userId: true },
  });
  if (!membership) throw new Error("STAFF_NOT_IN_ORG");
}

export async function getOrgVisitOrThrow(
  orgId: string,
  visitId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const visit = await client.visitLog.findFirst({
    where: { id: visitId, orgId, deletedAt: null },
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
          latitude: true,
          longitude: true,
        },
      },
      loggedBy: { select: { id: true, fullName: true, role: true } },
      visitTasks: {
        orderBy: { position: "asc" },
        include: {
          assignedTo: { select: { id: true, fullName: true } },
          completedBy: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!visit) throw new Error("VISIT_NOT_FOUND");
  return visit;
}

export function ensureVisitUnlocked(visit: Pick<VisitLog, "lockedAt">) {
  if (visit.lockedAt) throw new Error("VISIT_LOCKED");
}

export function getExpectedVisitLocation(visit: {
  serviceLatitude: number | null;
  serviceLongitude: number | null;
  patient?: { latitude: number | null; longitude: number | null } | null;
}) {
  if (visit.serviceLatitude !== null && visit.serviceLongitude !== null) {
    return {
      latitude: visit.serviceLatitude,
      longitude: visit.serviceLongitude,
    };
  }
  if (
    visit.patient &&
    visit.patient.latitude !== null &&
    visit.patient.longitude !== null
  ) {
    return {
      latitude: visit.patient.latitude,
      longitude: visit.patient.longitude,
    };
  }
  return null;
}

export function canPerformVisitAction(
  visit: Pick<VisitLog, "loggedById">,
  auth: { userId: string; orgRole?: string; userRole?: string },
) {
  return (
    visit.loggedById === auth.userId ||
    ["owner", "admin"].includes(auth.orgRole || "") ||
    ["agency_admin", "supervisor"].includes(auth.userRole || "")
  );
}

export function getVisitSubmissionBlockers(
  tasks: Array<{ required: boolean; status: VisitTaskStatus }>,
) {
  const incompleteRequiredTasks = tasks.filter(
    (task) => task.required && task.status !== "completed",
  ).length;

  return {
    incompleteRequiredTasks,
    canSubmit: incompleteRequiredTasks === 0,
  };
}
