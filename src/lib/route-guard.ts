/**
 * Route classification for Next.js middleware (staff app vs public vs portal).
 * Keep in sync with src/app route groups: (app), (auth), (portal).
 */

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
