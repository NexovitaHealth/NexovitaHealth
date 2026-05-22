import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionPayloadFromRequest } from "@/lib/session-edge";
import {
  buildLoginRedirectUrl,
  canAccessPage,
  isAuthPage,
  requiresStaffSession,
} from "@/lib/route-guard";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!requiresStaffSession(pathname)) {
    const session = await getSessionPayloadFromRequest(req);
    if (session && isAuthPage(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  const session = await getSessionPayloadFromRequest(req);
  if (!session) {
    return NextResponse.redirect(buildLoginRedirectUrl(req.url, pathname));
  }

  if (session.role && !canAccessPage(session.role, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
