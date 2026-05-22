import { NextRequest } from "next/server";
import { z } from "zod";
import {
  attachPortalSessionCookie,
  createPortalSession,
} from "@/lib/portal-auth";
import {
  markPortalAccessTokenUsed,
  portalPermissionsFor,
  resolvePortalAccessToken,
} from "@/lib/portal";
import {
  error,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  token: z.string().min(16),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const record = await resolvePortalAccessToken(parsed.data.token);
    await markPortalAccessTokenUsed(record.id);

    const session = await createPortalSession({
      subjectType: record.subjectType,
      orgId: record.orgId,
      patientId: record.patientId,
      familyCaregiverAccountId: record.familyCaregiverAccountId ?? undefined,
      portalAccessTokenId: record.id,
    });

    const permissions = portalPermissionsFor(
      record.subjectType,
      record.familyCaregiverAccount,
    );

    const actorId =
      record.createdById ||
      (record.subjectType === "family_caregiver"
        ? record.familyCaregiverAccount?.userId
        : undefined);

    if (actorId) {
      await createAuditLog({
        orgId: record.orgId,
        actorId,
        action: "login",
        resourceType: "portal_session",
        resourceId: record.id,
        patientId: record.patientId,
        metadata: {
          subjectType: record.subjectType,
          familyCaregiverAccountId: record.familyCaregiverAccountId,
        },
        req,
      });
    }

    const response = success({
      subjectType: record.subjectType,
      org: record.org,
      patient: {
        id: record.patient.id,
        fullName: record.patient.fullName,
      },
      familyCaregiver: record.familyCaregiverAccount
        ? {
            id: record.familyCaregiverAccount.id,
            relationship: record.familyCaregiverAccount.relationship,
            user: record.familyCaregiverAccount.user,
          }
        : undefined,
      permissions,
    });

    return attachPortalSessionCookie(
      response,
      session.token,
      session.expiresAt,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (
      [
        "PORTAL_TOKEN_INVALID",
        "PORTAL_TOKEN_REVOKED",
        "PORTAL_TOKEN_USED",
        "PORTAL_TOKEN_EXPIRED",
        "FAMILY_CAREGIVER_NOT_APPROVED",
        "FAMILY_CAREGIVER_REVOKED",
      ].includes(message)
    ) {
      return error("Invalid or expired portal access link", 401);
    }
    return serverError(err);
  }
}
