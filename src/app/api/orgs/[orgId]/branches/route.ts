import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { listOrgBranches, createBranch, BranchInputSchema } from "@/lib/branches";
import { serverError, success, created, validationError } from "@/lib/api-response";

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

export const POST = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const body = await req.json();
      const parsed = BranchInputSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      const branch = await createBranch(auth.orgId!, parsed.data);
      return created(branch);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "org:update_settings" },
);
