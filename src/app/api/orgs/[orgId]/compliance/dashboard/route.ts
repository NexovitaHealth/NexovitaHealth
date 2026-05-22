import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import { serverError, success } from "@/lib/api-response";
import { getOrgComplianceDashboard } from "@/lib/compliance-dashboard";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const trendDays = req.nextUrl.searchParams.get("trendDays");
      const summary = await getOrgComplianceDashboard(auth.orgId!, {
        trendDays: trendDays ?? undefined,
      });
      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "viewed",
        resourceType: "compliance_dashboard",
        resourceId: auth.orgId,
        req: req,
      });
      return success(summary);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "compliance:read" },
);
