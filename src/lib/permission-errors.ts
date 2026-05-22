import { forbidden } from "@/lib/api-response";
import { isPermissionDenied, PermissionDeniedError } from "@/lib/rbac";

const LEGACY_CODES: Record<string, string> = {
  BILLING_FORBIDDEN: "billing:manage",
  REVIEW_FORBIDDEN: "review:decide",
  FAMILY_CAREGIVER_FORBIDDEN: "caregiver:manage",
  PAYER_AUTH_FORBIDDEN: "authorisation:manage",
  INCIDENT_FORBIDDEN: "incident:report",
};

export function mapRbacError(err: unknown) {
  if (isPermissionDenied(err)) {
    const permission =
      err instanceof PermissionDeniedError
        ? err.permission
        : "unknown";
    return forbidden(`You do not have permission (${permission})`);
  }

  if (err instanceof Error && err.message in LEGACY_CODES) {
    return forbidden(
      `You do not have permission (${LEGACY_CODES[err.message]})`,
    );
  }

  return null;
}
