import { withPortalAccess } from "@/lib/portal-middleware";
import { success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  return success({
    subjectType: portal.subjectType,
    org: portal.org,
    patient: portal.patient,
    familyCaregiver: portal.familyCaregiver,
    permissions: portal.permissions,
  });
});
