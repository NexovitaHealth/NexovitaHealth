import { prisma } from "@/lib/prisma";
import { assertPortalPermission } from "@/lib/portal";
import { withPortalAccess } from "@/lib/portal-middleware";
import { error, serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (req, _ctx, portal) => {
  try {
    try {
      assertPortalPermission(portal.permissions, "canViewVitals");
    } catch {
      return error("Vitals access is not enabled for this portal session", 403);
    }

    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") || "20", 10),
      50,
    );

    const vitals = await prisma.patientVital.findMany({
      where: { patientId: portal.patientId },
      orderBy: { recordedAt: "desc" },
      take: limit,
      select: {
        id: true,
        recordedAt: true,
        systolicBp: true,
        diastolicBp: true,
        heartRate: true,
        respiratoryRate: true,
        temperature: true,
        oxygenSaturation: true,
        weight: true,
        bloodGlucose: true,
        painScore: true,
        notes: true,
      },
    });

    return success(vitals);
  } catch (err) {
    return serverError(err);
  }
});
