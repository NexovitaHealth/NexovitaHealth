import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  notFound,
  serverError,
  success,
} from "@/lib/api-response";
import {
  getOrgClinicalAlertOrThrow,
  resolveClinicalAlert,
} from "@/lib/clinical-alerts";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, ctx, auth) => {
    try {
      const alert = await getOrgClinicalAlertOrThrow(
        auth.orgId!,
        ctx.params.alertId,
      );
      return success(alert);
    } catch (err) {
      if (err instanceof Error && err.message === "ALERT_NOT_FOUND") {
        return notFound("Clinical alert");
      }
      return serverError(err);
    }
  },
  { permission: "alert:read" },
);

export const PATCH = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      const existing = await getOrgClinicalAlertOrThrow(
        auth.orgId!,
        ctx.params.alertId,
      );

      const updated = await resolveClinicalAlert(
        auth.orgId!,
        existing.id,
        auth.userId,
      );

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "updated",
        resourceType: "clinical_alert",
        resourceId: updated.id,
        patientId: updated.patientId,
        metadata: {
          isResolved: true,
          severity: updated.severity,
          alertType: updated.alertType,
        },
        req,
      });

      return success(updated);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "ALERT_NOT_FOUND") return notFound("Clinical alert");
        if (err.message === "ALERT_ALREADY_RESOLVED") {
          return error("Alert is already resolved", 409);
        }
      }
      return serverError(err);
    }
  },
  { permission: "alert:resolve" },
);
