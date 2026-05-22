import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import { serverError, success } from "@/lib/api-response";
import { getOrgComplianceDashboard } from "@/lib/compliance-dashboard";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, _ctx, auth) => {
    try {
      const summary = await getOrgComplianceDashboard(auth.orgId!);
      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "viewed",
        resourceType: "compliance_dashboard",
        resourceId: auth.orgId,
        req: _req,
      });
      return success(summary);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "compliance:read" },
);
