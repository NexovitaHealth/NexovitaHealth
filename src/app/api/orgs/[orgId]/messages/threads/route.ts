import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { listOrgMessageThreads } from "@/lib/messages";
import { success, serverError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, _ctx, auth) => {
    try {
      const threads = await listOrgMessageThreads(
        auth.orgId!,
        auth.userId,
        auth.user.role,
      );
      return success(threads);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "message:read" },
);
