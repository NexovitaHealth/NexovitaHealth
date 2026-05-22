import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import { serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  try {
    const medications = await prisma.patientMedication.findMany({
      where: { patientId: portal.patientId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        genericName: true,
        dosage: true,
        frequency: true,
        route: true,
        instructions: true,
        startDate: true,
        endDate: true,
      },
    });
    return success(medications);
  } catch (err) {
    return serverError(err);
  }
});
