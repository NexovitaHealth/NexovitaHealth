import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import { serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: portal.patientId, orgId: portal.orgId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
        status: true,
        riskLevel: true,
        primaryDiagnosis: true,
        phone: true,
        city: true,
        region: true,
        isHomeCare: true,
        isHospice: true,
        isPalliative: true,
      },
    });

    if (!patient) {
      return success(null);
    }

    return success({ patient, org: portal.org });
  } catch (err) {
    return serverError(err);
  }
});
