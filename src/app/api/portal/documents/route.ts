import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import { serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  try {
    const documents = await prisma.patientDocument.findMany({
      where: {
        patientId: portal.patientId,
        deletedAt: null,
        isVerified: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        documentType: true,
        mimeType: true,
        sizeBytes: true,
        fileUrl: true,
        verifiedAt: true,
        createdAt: true,
      },
    });
    return success(documents);
  } catch (err) {
    return serverError(err);
  }
});
