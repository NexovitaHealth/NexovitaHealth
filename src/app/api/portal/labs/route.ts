import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import { serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  try {
    const labs = await prisma.labOrder.findMany({
      where: {
        patientId: portal.patientId,
        status: { in: ["resulted", "collected"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        panelName: true,
        status: true,
        priority: true,
        resultedAt: true,
        createdAt: true,
        results: {
          select: {
            id: true,
            componentName: true,
            value: true,
            unit: true,
            referenceMin: true,
            referenceMax: true,
            isAbnormal: true,
            isCritical: true,
          },
        },
      },
    });
    return success(labs);
  } catch (err) {
    return serverError(err);
  }
});
