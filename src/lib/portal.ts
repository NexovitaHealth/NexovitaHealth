import { createHash, randomBytes } from "node:crypto";
import type { FamilyCaregiverAccount, PortalSubjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PORTAL_ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const familyCaregiverInclude = {
  patient: { select: { id: true, fullName: true } },
  user: { select: { id: true, email: true, fullName: true, phone: true } },
  approvedBy: { select: { id: true, fullName: true } },
} as const;

export function createPortalAccessTokenValue() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashPortalAccessToken(token),
    expiresAt: new Date(Date.now() + PORTAL_ACCESS_TTL_MS),
  };
}

export function hashPortalAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getOrgFamilyCaregiverOrThrow(
  orgId: string,
  accountId: string,
) {
  const account = await prisma.familyCaregiverAccount.findFirst({
    where: { id: accountId, orgId },
    include: familyCaregiverInclude,
  });
  if (!account) throw new Error("FAMILY_CAREGIVER_NOT_FOUND");
  return account;
}

export async function resolvePortalAccessToken(rawToken: string) {
  const tokenHash = hashPortalAccessToken(rawToken.trim());
  const record = await prisma.portalAccessToken.findUnique({
    where: { tokenHash },
    include: {
      patient: {
        select: {
          id: true,
          orgId: true,
          fullName: true,
          deletedAt: true,
        },
      },
      familyCaregiverAccount: {
        include: familyCaregiverInclude,
      },
      org: { select: { id: true, name: true, slug: true, deletedAt: true } },
    },
  });

  if (!record) throw new Error("PORTAL_TOKEN_INVALID");
  if (record.revokedAt) throw new Error("PORTAL_TOKEN_REVOKED");
  if (record.usedAt) throw new Error("PORTAL_TOKEN_USED");
  if (record.expiresAt < new Date()) throw new Error("PORTAL_TOKEN_EXPIRED");
  if (record.org.deletedAt || record.patient.deletedAt) {
    throw new Error("PORTAL_TOKEN_INVALID");
  }

  if (record.subjectType === "family_caregiver") {
    const account = record.familyCaregiverAccount;
    if (!account) throw new Error("PORTAL_TOKEN_INVALID");
    if (account.status !== "approved") throw new Error("FAMILY_CAREGIVER_NOT_APPROVED");
    if (account.revokedAt) throw new Error("FAMILY_CAREGIVER_REVOKED");
  }

  return record;
}

export async function markPortalAccessTokenUsed(id: string) {
  await prisma.portalAccessToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}

export type PortalPermissions = {
  subjectType: PortalSubjectType;
  canViewSchedule: boolean;
  canViewCarePlan: boolean;
  canViewVitals: boolean;
  canMessageCareTeam: boolean;
};

export function portalPermissionsFor(
  subjectType: PortalSubjectType,
  account?: FamilyCaregiverAccount | null,
): PortalPermissions {
  if (subjectType === "patient") {
    return {
      subjectType,
      canViewSchedule: true,
      canViewCarePlan: true,
      canViewVitals: true,
      canMessageCareTeam: false,
    };
  }

  if (!account) {
    throw new Error("FAMILY_CAREGIVER_NOT_FOUND");
  }

  return {
    subjectType,
    canViewSchedule: account.canViewSchedule,
    canViewCarePlan: account.canViewCarePlan,
    canViewVitals: account.canViewVitals,
    canMessageCareTeam: account.canMessageCareTeam,
  };
}

export function assertPortalPermission(
  permissions: PortalPermissions,
  key: keyof Omit<PortalPermissions, "subjectType">,
) {
  if (!permissions[key]) throw new Error("PORTAL_PERMISSION_DENIED");
}

export async function findOrCreateFamilyCaregiverUser(params: {
  email: string;
  fullName: string;
  phone?: string;
}) {
  const email = params.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.deletedAt || !existing.isActive) {
      throw new Error("FAMILY_CAREGIVER_USER_INACTIVE");
    }
    return existing;
  }

  const { hashPassword } = await import("@/lib/auth");
  const passwordHash = await hashPassword(randomBytes(24).toString("base64url"));

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: params.fullName,
      phone: params.phone,
      role: "family_caregiver",
      emailVerified: false,
    },
  });
}
