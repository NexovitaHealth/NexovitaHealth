import type { Permission } from "@/lib/permissions";
import { canUserPerform } from "@/lib/permissions";
import { getStaffHomePath } from "@/lib/physician-nav";

export { getStaffHomePath } from "@/lib/physician-nav";

/**
 * Route classification for Next.js middleware (staff app vs public vs portal).
 * Keep in sync with src/app route groups: (app), (auth), (portal).
 */

/** Staff pages that require a specific permission (user role from session JWT). */
export const PAGE_PERMISSIONS: Record<string, Permission> = {
  "/billing": "billing:manage",
  "/audit": "audit:read",
  "/reports": "report:view",
  "/visit-review": "review:decide",
  "/physician": "physician:portal",
  "/care-plans": "careplan:read",
  "/physician-orders": "physician_order:manage",
  "/alerts": "alert:read",
  "/escalations": "escalation:read",
  "/family-caregivers": "caregiver:manage",
  "/supervisor": "clinical:supervise",
  "/my-visits": "visit:checkin",
};

export function getPagePermission(pathname: string): Permission | undefined {
  if (PAGE_PERMISSIONS[pathname]) return PAGE_PERMISSIONS[pathname];
  for (const [path, permission] of Object.entries(PAGE_PERMISSIONS)) {
    if (pathname.startsWith(`${path}/`)) return permission;
  }
  return undefined;
}

export function canAccessPage(role: string, pathname: string) {
  const permission = getPagePermission(pathname);
  if (!permission) return true;
  return canUserPerform(role, null, permission);
}

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

const PUBLIC_PREFIXES = [
  "/invite/",
  "/portal",
  "/api/",
  "/_next/",
  "/icons/",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/file.svg",
  "/vercel.svg",
  "/window.svg",
] as const;

/** Paths that require a valid staff session cookie. */
export function requiresStaffSession(pathname: string) {
  if (AUTH_PATHS.has(pathname)) return false;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return true;
}

export function isAuthPage(pathname: string) {
  return AUTH_PATHS.has(pathname);
}

export function buildLoginRedirectUrl(requestUrl: string, pathname: string) {
  const login = new URL("/login", requestUrl);
  if (pathname && pathname !== "/") {
    login.searchParams.set("redirect", pathname);
  }
  return login;
}
