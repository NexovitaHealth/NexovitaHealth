import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { success, serverError } from "@/lib/api-response";
import { getOrgDashboardSummary } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    const branchId = req.nextUrl.searchParams.get("branchId") || undefined;
    const summary = await getOrgDashboardSummary(auth.orgId!, branchId, auth.orgHasBranches);
    return success(summary);
  } catch (err) {
    return serverError(err);
  }
});
