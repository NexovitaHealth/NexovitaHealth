/** Staff roles that use the physician portal shell (filtered nav + home). */
export const PHYSICIAN_PORTAL_ROLES = [
  "physician",
  "physician_independent",
] as const;

export function isPhysicianPortalRole(role: string | undefined | null) {
  return (
    !!role &&
    (PHYSICIAN_PORTAL_ROLES as readonly string[]).includes(role)
  );
}

/** Sidebar routes shown in physician portal mode. */
export const PHYSICIAN_NAV_HREFS = new Set([
  "/physician",
  "/patients",
  "/care-plans",
  "/physician-orders",
  "/escalations",
  "/alerts",
  "/visit-review",
  "/vitals",
  "/labs",
  "/messages",
  "/notifications",
  "/settings",
]);

export function getStaffHomePath(role: string | undefined | null) {
  if (role === 'owner') return '/admin';
  return isPhysicianPortalRole(role) ? "/physician" : "/dashboard";
}
