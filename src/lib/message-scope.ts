import { prisma } from "@/lib/prisma";

export const FIELD_STAFF_ROLES = ["aide", "school_nurse"] as const;

export type FieldStaffRole = (typeof FIELD_STAFF_ROLES)[number];

export function isFieldStaffRole(role: string): role is FieldStaffRole {
  return (FIELD_STAFF_ROLES as readonly string[]).includes(role);
}

export async function getFieldStaffPatientIds(
  userId: string,
  orgId: string,
): Promise<string[]> {
  const rows = await prisma.patientCareTeam.findMany({
    where: {
      userId,
      isActive: true,
      patient: { orgId, deletedAt: null, isDraft: false },
    },
    select: { patientId: true },
  });
  return rows.map((row) => row.patientId);
}

export async function userOnPatientCareTeam(
  userId: string,
  patientId: string,
): Promise<boolean> {
  const row = await prisma.patientCareTeam.findFirst({
    where: { patientId, userId, isActive: true },
    select: { id: true },
  });
  return !!row;
}

export async function getPatientCareTeamContacts(
  patientId: string,
  orgId: string,
  excludeUserId?: string,
) {
  const members = await prisma.patientCareTeam.findMany({
    where: {
      patientId,
      isActive: true,
      patient: { orgId, deletedAt: null },
    },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, role: true },
      },
    },
    orderBy: { user: { fullName: "asc" } },
  });

  return members
    .filter((member) => member.userId !== excludeUserId)
    .map((member) => ({
      id: member.user.id,
      fullName: member.user.fullName,
      email: member.user.email,
      userRole: member.user.role,
      careTeamRole: member.role,
    }));
}

export async function assertRecipientsOnPatientCareTeam(
  patientId: string,
  recipientIds: string[],
) {
  const allowed = await prisma.patientCareTeam.findMany({
    where: { patientId, isActive: true, userId: { in: recipientIds } },
    select: { userId: true },
  });
  const allowedSet = new Set(allowed.map((row) => row.userId));
  return recipientIds.every((id) => allowedSet.has(id));
}

export function threadVisibleToFieldStaff(
  thread: { patientId: string | null },
  accessiblePatientIds: ReadonlySet<string>,
): boolean {
  if (!thread.patientId) return false;
  return accessiblePatientIds.has(thread.patientId);
}
