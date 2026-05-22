import { prisma } from "@/lib/prisma";
import { assertPortalPermission } from "@/lib/portal";
import { withPortalAccess } from "@/lib/portal-middleware";
import { error, serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (req, _ctx, portal) => {
  try {
    try {
      assertPortalPermission(portal.permissions, "canViewSchedule");
    } catch {
      return error("Schedule access is not enabled for this portal session", 403);
    }

    const days = Math.min(
      parseInt(req.nextUrl.searchParams.get("days") || "30", 10),
      90,
    );
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);

    const visits = await prisma.visitLog.findMany({
      where: {
        orgId: portal.orgId,
        patientId: portal.patientId,
        deletedAt: null,
        scheduledAt: { gte: from, lte: to },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      select: {
        id: true,
        visitType: true,
        status: true,
        scheduledAt: true,
        checkinAt: true,
        checkoutAt: true,
        durationMinutes: true,
        loggedBy: { select: { fullName: true } },
      },
    });

    return success(visits);
  } catch (err) {
    return serverError(err);
  }
});
