import { prisma } from "@/lib/prisma";
import { carePlanInclude } from "@/lib/care-plans";
import { assertPortalPermission } from "@/lib/portal";
import { withPortalAccess } from "@/lib/portal-middleware";
import { error, serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  try {
    try {
      assertPortalPermission(portal.permissions, "canViewCarePlan");
    } catch {
      return error("Care plan access is not enabled for this portal session", 403);
    }

    const carePlan = await prisma.carePlan.findFirst({
      where: {
        orgId: portal.orgId,
        patientId: portal.patientId,
        deletedAt: null,
        status: "active",
      },
      orderBy: { version: "desc" },
      include: carePlanInclude,
    });

    return success(carePlan);
  } catch (err) {
    return serverError(err);
  }
});
