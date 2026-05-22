import { NextRequest } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { error, serverError, success } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { processMissedVisitsForOrg } from "@/lib/missed-visits";

export const dynamic = "force-dynamic";

const ALLOWED = ["agency_admin", "supervisor", "billing_manager"];

export const POST = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    if (!ALLOWED.includes(auth.user.role)) {
      return error("Only supervisors or billing staff can run missed-visit processing", 403);
    }

    const result = await processMissedVisitsForOrg(auth.orgId!);
    if (result.marked > 0) {
      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "status_changed",
        resourceType: "visit",
        resourceId: result.visitIds[0],
        metadata: {
          automated: true,
          missedCount: result.marked,
          visitIds: result.visitIds,
        },
        req,
      });
    }

    return success(result);
  } catch (err) {
    return serverError(err);
  }
});
