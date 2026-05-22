import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { listOrgBranches } from "@/lib/branches";
import { serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, _ctx, auth) => {
    try {
      const branches = await listOrgBranches(auth.orgId!);
      return success(branches);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "patient:read" },
);
