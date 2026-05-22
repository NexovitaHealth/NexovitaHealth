import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * Edge-safe session check for Next.js middleware.
 * Verifies JWT signature/expiry only; API routes still validate DB session via getSessionFromRequest.
 */
export async function getSessionPayloadFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
