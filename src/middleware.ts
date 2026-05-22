import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionPayloadFromRequest } from "@/lib/session-edge";
import {
  buildLoginRedirectUrl,
  canAccessPage,
  getStaffHomePath,
  isAuthPage,
  requiresStaffSession,
} from "@/lib/route-guard";
import { isPhysicianPortalRole } from "@/lib/physician-nav";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!requiresStaffSession(pathname)) {
    const session = await getSessionPayloadFromRequest(req);
    if (session && isAuthPage(pathname)) {
      return NextResponse.redirect(
        new URL(getStaffHomePath(session.role), req.url),
      );
    }
    return NextResponse.next();
  }

  const session = await getSessionPayloadFromRequest(req);
  if (!session) {
    return NextResponse.redirect(buildLoginRedirectUrl(req.url, pathname));
  }

  if (session.role && !canAccessPage(session.role, pathname)) {
    return NextResponse.redirect(
      new URL(getStaffHomePath(session.role), req.url),
    );
  }

  if (
    session.role &&
    isPhysicianPortalRole(session.role) &&
    (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))
  ) {
    return NextResponse.redirect(new URL("/physician", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
