import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  created,
  error,
  notFound,
  serverError,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { sendPortalAccessEmail } from "@/lib/email";
import { assertFamilyCaregiverManager } from "@/lib/family-caregivers";
import {
  createPortalAccessTokenValue,
  getOrgFamilyCaregiverOrThrow,
} from "@/lib/portal";

export const dynamic = "force-dynamic";

export const POST = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      try {
        assertFamilyCaregiverManager(auth);
      } catch {
        return error("Insufficient permissions to issue portal access", 403);
      }

      const account = await getOrgFamilyCaregiverOrThrow(
        auth.orgId!,
        ctx.params.accountId,
      );

      if (account.status !== "approved") {
        return error("Portal access can only be issued to approved caregivers", 409);
      }

      const { token, tokenHash, expiresAt } = createPortalAccessTokenValue();

      const portalToken = await prisma.portalAccessToken.create({
        data: {
          orgId: auth.orgId!,
          patientId: account.patientId,
          subjectType: "family_caregiver",
          familyCaregiverAccountId: account.id,
          tokenHash,
          expiresAt,
          createdById: auth.userId,
        },
      });

      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal/login?token=${encodeURIComponent(token)}`;

      await sendPortalAccessEmail({
        email: account.user.email,
        recipientName: account.user.fullName,
        patientName: account.patient.fullName,
        portalLabel: "family caregiver portal",
        token,
      }).catch((err) => {
        console.error("[Portal] Failed to send family portal email", err);
      });

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "created",
        resourceType: "portal_access_token",
        resourceId: portalToken.id,
        patientId: account.patientId,
        metadata: {
          subjectType: "family_caregiver",
          familyCaregiverAccountId: account.id,
        },
        req,
      });

      return created({
        portalUrl,
        expiresAt,
        token,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "FAMILY_CAREGIVER_NOT_FOUND") return notFound("Family caregiver");
      return serverError(err);
    }
  },
);
