import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { serverError, success } from "@/lib/api-response";
import { getPhysicianPortalSummary } from "@/lib/physician-portal";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, _ctx, auth) => {
    try {
      const summary = await getPhysicianPortalSummary(
        auth.orgId!,
        auth.userId,
      );
      return success(summary);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "physician:portal" },
);
