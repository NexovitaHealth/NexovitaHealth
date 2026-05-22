import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import { error, serverError, success } from "@/lib/api-response";
import { retryEmailDelivery } from "@/lib/email-delivery";
import { resendDeliveryLog } from "@/lib/email";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["agency_admin"];

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    if (!ADMIN_ROLES.includes(auth.user.role)) {
      return error("Only agency admins can retry email deliveries", 403);
    }

    const queued = await retryEmailDelivery(ctx.params.deliveryId, auth.orgId!);
    if (!queued) return error("Delivery log not found", 404);

    let resent = queued;
    try {
      resent = await resendDeliveryLog(queued.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Retry failed";
      return error(message, 422);
    }

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "updated",
      resourceType: "email_delivery",
      resourceId: queued.id,
      metadata: { action: "retry" },
      req,
    });

    return success(resent);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "BOUNCED") {
        return error("Bounced messages cannot be retried", 409);
      }
      if (err.message === "MAX_ATTEMPTS") {
        return error("Maximum retry attempts reached", 409);
      }
      if (err.message === "ALREADY_SENT") {
        return error("Message was already delivered", 409);
      }
    }
    return serverError(err);
  }
});
