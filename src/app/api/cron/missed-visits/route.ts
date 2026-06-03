import { NextRequest } from "next/server";
import { error, serverError, success } from "@/lib/api-response";
import { assertCronSecret, CronAuthError } from "@/lib/cron-auth";
import {
  processMissedVisitsAllOrgs,
  processMissedVisitsForOrg,
} from "@/lib/missed-visits";

export const dynamic = "force-dynamic";

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
    if (err instanceof CronAuthError) {
      if (err.code === "CRON_NOT_CONFIGURED") {
        return error("CRON_SECRET is not configured", 503);
      }
      return error("Unauthorized", 401);
    }
    return serverError(err);
  }
}
