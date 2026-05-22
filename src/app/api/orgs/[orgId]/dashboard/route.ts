import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { success, serverError } from "@/lib/api-response";
import { getOrgDashboardSummary } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (_req: NextRequest, _ctx, auth) => {
  try {
    const summary = await getOrgDashboardSummary(auth.orgId!);
    return success(summary);
  } catch (err) {
    return serverError(err);
  }
});
