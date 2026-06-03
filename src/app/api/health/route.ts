import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness: GET /api/health
 * Readiness (DB): GET /api/health?check=db
 */
export async function GET(req: NextRequest) {
  const started = Date.now();
  const checkDb = req.nextUrl.searchParams.get("check") === "db";

  if (!checkDb) {
    return NextResponse.json(
      {
        status: "ok",
        service: "nexovita",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        checks: { database: "ok" },
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        checks: { database: "unavailable" },
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
