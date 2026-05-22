import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  error,
  notFound,
  serverError,
  success,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import {
  assertFamilyCaregiverManager,
  familyCaregiverInclude,
} from "@/lib/family-caregivers";
import { getOrgFamilyCaregiverOrThrow } from "@/lib/portal";

export const dynamic = "force-dynamic";

export const PATCH = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      try {
        assertFamilyCaregiverManager(auth);
      } catch {
        return error("Insufficient permissions to approve family caregivers", 403);
      }

      const account = await getOrgFamilyCaregiverOrThrow(
        auth.orgId!,
        ctx.params.accountId,
      );

      if (account.status !== "pending") {
        return error("Only pending caregiver requests can be approved", 409);
      }

      const updated = await prisma.familyCaregiverAccount.update({
        where: { id: account.id },
        data: {
          status: "approved",
          approvedById: auth.userId,
          approvedAt: new Date(),
          revokedAt: null,
        },
        include: familyCaregiverInclude,
      });

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "status_changed",
        resourceType: "family_caregiver_account",
        resourceId: account.id,
        patientId: account.patientId,
        metadata: { status: "approved" },
        req,
      });

      return success(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "FAMILY_CAREGIVER_NOT_FOUND") return notFound("Family caregiver");
      return serverError(err);
    }
  },
);
