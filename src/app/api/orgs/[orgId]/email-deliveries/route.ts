import { NextRequest } from "next/server";
import type { EmailDeliveryStatus } from "@prisma/client";
import { withOrgAccess } from "@/lib/middleware";
import { error, serverError, success } from "@/lib/api-response";
import { listEmailDeliveries } from "@/lib/email-delivery";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["agency_admin"];

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    if (!ADMIN_ROLES.includes(auth.user.role)) {
      return error("Only agency admins can view email delivery logs", 403);
    }

    const status = req.nextUrl.searchParams.get("status") as
      | EmailDeliveryStatus
      | null;
    const page = Number(req.nextUrl.searchParams.get("page") || 1);
    const pageSize = Number(req.nextUrl.searchParams.get("pageSize") || 25);

    const result = await listEmailDeliveries(auth.orgId!, {
      status: status ?? undefined,
      page,
      pageSize,
    });

    return success(result);
  } catch (err) {
    return serverError(err);
  }
});
