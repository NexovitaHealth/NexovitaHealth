import { NextRequest } from "next/server";
import { error, serverError, success } from "@/lib/api-response";
import {
  processMissedVisitsAllOrgs,
  processMissedVisitsForOrg,
} from "@/lib/missed-visits";

export const dynamic = "force-dynamic";

function assertCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_NOT_CONFIGURED");
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== secret) throw new Error("CRON_UNAUTHORIZED");
}

export async function POST(req: NextRequest) {
  try {
    assertCronSecret(req);

    const orgId = req.nextUrl.searchParams.get("orgId");
    if (orgId) {
      const result = await processMissedVisitsForOrg(orgId);
      return success(result);
    }

    const result = await processMissedVisitsAllOrgs();
    return success(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "CRON_NOT_CONFIGURED") {
        return error("CRON_SECRET is not configured", 503);
      }
      if (err.message === "CRON_UNAUTHORIZED") {
        return error("Unauthorized", 401);
      }
    }
    return serverError(err);
  }
}
