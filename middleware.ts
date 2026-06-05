import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Cloudflare Token Guard
 *
 * All requests must pass through Cloudflare (which injects X-Cloudflare-Token).
 * Direct requests to the Cloud Run URL are rejected with 403.
 *
 * Bypass routes (no token required):
 *  - /api/health  — Cloud Run health probe hits this directly
 */

const BYPASS_PATHS = ["/api/health"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow bypass paths through unconditionally
  if (BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = process.env.CLOUDFLARE_TOKEN;

  // If CLOUDFLARE_TOKEN is not configured, skip enforcement (dev/local)
  if (!token) {
    return NextResponse.next();
  }

  const incoming = request.headers.get("x-cloudflare-token");

  if (incoming !== token) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
