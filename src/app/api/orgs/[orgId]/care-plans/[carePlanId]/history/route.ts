import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { notFound, serverError, success } from "@/lib/api-response";
import { getCarePlanVersionHistory } from "@/lib/care-plans";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, ctx, auth) => {
    try {
      const history = await getCarePlanVersionHistory(
        auth.orgId!,
        ctx.params.carePlanId,
      );
      return success(history);
    } catch (err) {
      if (err instanceof Error && err.message === "CARE_PLAN_NOT_FOUND") {
        return notFound("Care plan");
      }
      return serverError(err);
    }
  },
  { permission: "careplan:read" },
);
