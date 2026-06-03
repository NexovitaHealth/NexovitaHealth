import { NextRequest } from "next/server";
import { error, serverError, success } from "@/lib/api-response";
import { assertCronSecret, CronAuthError } from "@/lib/cron-auth";
import { getDeliveriesReadyForRetry } from "@/lib/email-delivery";
import { resendDeliveryLog } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertCronSecret(req);

    const pending = await getDeliveriesReadyForRetry(25);
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const log of pending) {
      try {
        await resendDeliveryLog(log.id);
        results.push({ id: log.id, ok: true });
      } catch (err) {
        results.push({
          id: log.id,
          ok: false,
          error: err instanceof Error ? err.message : "failed",
        });
      }
    }

    return success({ processed: results.length, results });
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
