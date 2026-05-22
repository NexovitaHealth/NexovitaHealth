import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { error, paginated, serverError, validationError } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { getPagination } from "@/lib/pagination";
import { assertClinicalReviewer, reviewInclude } from "@/lib/billing";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z
    .enum(["pending", "approved", "needs_correction", "rejected"])
    .optional(),
  patientId: z.string().uuid().optional(),
});

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    assertClinicalReviewer(auth);

    const parsed = querySchema.safeParse({
      status: req.nextUrl.searchParams.get("status") || undefined,
      patientId: req.nextUrl.searchParams.get("patientId") || undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const { skip, take, page, pageSize } = getPagination(req, 50);
    const where = {
      orgId: auth.orgId!,
      ...(parsed.data.status && { status: parsed.data.status }),
      ...(parsed.data.patientId && { patientId: parsed.data.patientId }),
    };

    const [reviews, total] = await Promise.all([
      prisma.visitReview.findMany({
        where,
        skip,
        take,
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: reviewInclude,
      }),
      prisma.visitReview.count({ where }),
    ]);

    return paginated(reviews, total, page, pageSize);
  } catch (err) {
    if (err instanceof Error && err.message === "REVIEW_FORBIDDEN") {
      return error("Only clinical reviewers can access the visit review queue", 403);
    }
    return serverError(err);
  }
});
