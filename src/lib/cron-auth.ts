import type { NextRequest } from "next/server";

export class CronAuthError extends Error {
  constructor(
    readonly code: "CRON_NOT_CONFIGURED" | "CRON_UNAUTHORIZED",
  ) {
    super(code);
    this.name = "CronAuthError";
  }
}

/** Validates Cloud Scheduler / internal cron Bearer token. */
export function assertCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new CronAuthError("CRON_NOT_CONFIGURED");

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token !== secret) throw new CronAuthError("CRON_UNAUTHORIZED");
}
