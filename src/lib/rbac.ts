import type { AuthContext } from "@/lib/middleware";
import { canUserPerform, type Permission } from "@/lib/permissions";

export class PermissionDeniedError extends Error {
  readonly code = "PERMISSION_DENIED";

  constructor(
    public readonly permission: Permission,
    message?: string,
  ) {
    super(message ?? `Missing permission: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export function assertPermission(
  auth: Pick<AuthContext, "user" | "orgRole">,
  permission: Permission,
) {
  if (
    !canUserPerform(auth.user.role, auth.orgRole ?? null, permission)
  ) {
    throw new PermissionDeniedError(permission);
  }
}

export function isPermissionDenied(err: unknown): err is PermissionDeniedError {
  return (
    err instanceof PermissionDeniedError ||
    (err instanceof Error && err.message === "PERMISSION_DENIED")
  );
}

/** @deprecated Use assertPermission(auth, 'billing:manage') */
export function assertBillingAccess(auth: Pick<AuthContext, "user" | "orgRole">) {
  assertPermission(auth, "billing:manage");
}

/** @deprecated Use assertPermission(auth, 'review:decide') */
export function assertClinicalReviewAccess(
  auth: Pick<AuthContext, "user" | "orgRole">,
) {
  assertPermission(auth, "review:decide");
}

/** @deprecated Use assertPermission(auth, 'caregiver:manage') */
export function assertCaregiverManageAccess(
  auth: Pick<AuthContext, "user" | "orgRole">,
) {
  assertPermission(auth, "caregiver:manage");
}

/** @deprecated Use assertPermission(auth, 'authorisation:manage') */
export function assertAuthorisationManageAccess(
  auth: Pick<AuthContext, "user" | "orgRole">,
) {
  assertPermission(auth, "authorisation:manage");
}

/** @deprecated Use assertPermission(auth, 'authorisation:manage') — readers use billing:read */
export function assertAuthorisationReadAccess(
  auth: Pick<AuthContext, "user" | "orgRole">,
) {
  if (
    !canUserPerform(auth.user.role, auth.orgRole ?? null, "billing:read") &&
    !canUserPerform(auth.user.role, auth.orgRole ?? null, "authorisation:manage")
  ) {
    throw new PermissionDeniedError("authorisation:manage");
  }
}

export function assertIncidentReportAccess(
  auth: Pick<AuthContext, "user" | "orgRole">,
) {
  assertPermission(auth, "incident:report");
}

export function assertIncidentManageAccess(
  auth: Pick<AuthContext, "user" | "orgRole">,
) {
  assertPermission(auth, "incident:manage");
}

export function assertEscalationManageAccess(
  auth: Pick<AuthContext, "user" | "orgRole">,
) {
  assertPermission(auth, "escalation:manage");
}
