import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import { serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  try {
    const careTeam = await prisma.patientCareTeam.findMany({
      where: { patientId: portal.patientId, isActive: true },
      orderBy: { assignedAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
            phone: true,
          },
        },
      },
    });

    return success(
      careTeam.map((entry) => ({
        id: entry.id,
        role: entry.role,
        assignedAt: entry.assignedAt,
        user: entry.user,
      })),
    );
  } catch (err) {
    return serverError(err);
  }
});
