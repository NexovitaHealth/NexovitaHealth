import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { PortalSubjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  portalPermissionsFor,
  type PortalPermissions,
} from "@/lib/portal";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "nexovita-dev-secret-change-in-production",
);

export const PORTAL_SESSION_COOKIE = "nexovita_portal_session";
export const PORTAL_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export interface PortalJWTPayload {
  kind: "portal";
  subjectType: PortalSubjectType;
  orgId: string;
  patientId: string;
  familyCaregiverAccountId?: string;
  portalAccessTokenId: string;
}

export interface PortalAuthContext {
  subjectType: PortalSubjectType;
  orgId: string;
  patientId: string;
  familyCaregiverAccountId?: string;
  portalAccessTokenId: string;
  permissions: PortalPermissions;
  patient: {
    id: string;
    fullName: string;
    orgId: string;
  };
  org: {
    id: string;
    name: string;
    slug: string;
  };
  familyCaregiver?: {
    id: string;
    relationship: string;
    user: { id: string; email: string; fullName: string };
  };
}

export async function createPortalSession(payload: Omit<PortalJWTPayload, "kind">) {
  const jwtPayload: PortalJWTPayload = { kind: "portal", ...payload };
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_MAX_AGE * 1000);

  const token = await new SignJWT({
    ...jwtPayload,
    familyCaregiverAccountId: jwtPayload.familyCaregiverAccountId ?? "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  return { token, expiresAt };
}

export async function verifyPortalSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const data = payload as unknown as PortalJWTPayload;
    if (data.kind !== "portal") return null;
    return data;
  } catch {
    return null;
  }
}

export async function getPortalSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyPortalSession(token);
  if (!payload) return null;

  const patient = await prisma.patient.findFirst({
    where: {
      id: payload.patientId,
      orgId: payload.orgId,
      deletedAt: null,
    },
    select: { id: true, fullName: true, orgId: true },
  });
  if (!patient) return null;

  const org = await prisma.organization.findFirst({
    where: { id: payload.orgId, deletedAt: null, isActive: true },
    select: { id: true, name: true, slug: true },
  });
  if (!org) return null;

  let familyCaregiver = undefined;
  let account = null;

  const familyCaregiverAccountId =
    payload.familyCaregiverAccountId && payload.familyCaregiverAccountId.length > 0
      ? payload.familyCaregiverAccountId
      : undefined;

  if (payload.subjectType === "family_caregiver") {
    if (!familyCaregiverAccountId) return null;
    account = await prisma.familyCaregiverAccount.findFirst({
      where: {
        id: familyCaregiverAccountId,
        orgId: payload.orgId,
        patientId: payload.patientId,
        status: "approved",
        revokedAt: null,
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!account) return null;
    familyCaregiver = {
      id: account.id,
      relationship: account.relationship,
      user: account.user,
    };
  }

  const permissions = portalPermissionsFor(payload.subjectType, account);

  return {
    subjectType: payload.subjectType,
    orgId: payload.orgId,
    patientId: payload.patientId,
    familyCaregiverAccountId,
    portalAccessTokenId: payload.portalAccessTokenId,
    permissions,
    patient,
    org,
    familyCaregiver,
  } satisfies PortalAuthContext;
}

export function setPortalSessionCookie(token: string, expiresAt: Date) {
  cookies().set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearPortalSessionCookie() {
  cookies().delete(PORTAL_SESSION_COOKIE);
}

export function attachPortalSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
  return response;
}

export function clearPortalSessionOnResponse(response: NextResponse) {
  response.cookies.delete(PORTAL_SESSION_COOKIE);
  return response;
}
