import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { updateBranch, deactivateBranch, BranchInputSchema } from "@/lib/branches";
import { serverError, success, notFound, validationError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const PATCH = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    const { branchId } = ctx.params;
    try {
      const body = await req.json();
      const parsed = BranchInputSchema.partial().safeParse(body);
      if (!parsed.success) return validationError(parsed.error);
      const branch = await updateBranch(auth.orgId!, branchId, parsed.data);
      return success(branch);
    } catch (err) {
      if (err instanceof Error && err.message === "BRANCH_NOT_FOUND") return notFound("Location");
      return serverError(err);
    }
  },
  { permission: "org:update_settings" },
);

export const DELETE = withOrgAccess(
  async (_req: NextRequest, ctx, auth) => {
    const { branchId } = ctx.params;
    try {
      await deactivateBranch(auth.orgId!, branchId);
      return success({ deactivated: true });
    } catch (err) {
      if (err instanceof Error && err.message === "BRANCH_NOT_FOUND") return notFound("Location");
      return serverError(err);
    }
  },
  { permission: "org:update_settings" },
);
