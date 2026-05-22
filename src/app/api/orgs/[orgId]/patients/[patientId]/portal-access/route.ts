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
import { getOrgPatientOrThrow } from "@/lib/care-plans";
import { assertFamilyCaregiverManager } from "@/lib/family-caregivers";
import { createPortalAccessTokenValue } from "@/lib/portal";

export const dynamic = "force-dynamic";

export const POST = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      try {
        assertFamilyCaregiverManager(auth.user.role, auth.orgRole);
      } catch {
        return error("Insufficient permissions to issue patient portal access", 403);
      }

      const patient = await prisma.patient.findFirst({
        where: {
          id: ctx.params.patientId,
          orgId: auth.orgId!,
          deletedAt: null,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      });

      if (!patient) return notFound("Patient");
      if (!patient.email) {
        return error("Patient must have an email address to receive portal access", 422);
      }

      await getOrgPatientOrThrow(auth.orgId!, patient.id);

      const { token, tokenHash, expiresAt } = createPortalAccessTokenValue();

      const portalToken = await prisma.portalAccessToken.create({
        data: {
          orgId: auth.orgId!,
          patientId: patient.id,
          subjectType: "patient",
          tokenHash,
          expiresAt,
          createdById: auth.userId,
        },
      });

      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal/login?token=${encodeURIComponent(token)}`;

      await sendPortalAccessEmail({
        email: patient.email,
        recipientName: patient.fullName,
        patientName: patient.fullName,
        portalLabel: "patient portal",
        token,
      }).catch((err) => {
        console.error("[Portal] Failed to send patient portal email", err);
      });

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "created",
        resourceType: "portal_access_token",
        resourceId: portalToken.id,
        patientId: patient.id,
        metadata: { subjectType: "patient" },
        req,
      });

      return created({
        portalUrl,
        expiresAt,
        token,
      });
    } catch (err) {
      return serverError(err);
    }
  },
);
