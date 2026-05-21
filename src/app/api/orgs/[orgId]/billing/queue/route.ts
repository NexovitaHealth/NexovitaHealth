import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, paginated, serverError } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { getPagination } from "@/lib/pagination";
import { assertBillingUser, reviewInclude } from "@/lib/billing";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    assertBillingUser(auth.user.role);

    const { skip, take, page, pageSize } = getPagination(req, 50);
    const where = {
      orgId: auth.orgId!,
      status: "approved" as const,
      visitLog: {
        claim: null,
      },
    };

    const [items, total] = await Promise.all([
      prisma.visitReview.findMany({
        where,
        skip,
        take,
        orderBy: { reviewedAt: "asc" },
        include: reviewInclude,
      }),
      prisma.visitReview.count({ where }),
    ]);

    return paginated(items, total, page, pageSize);
  } catch (err) {
    if (err instanceof Error && err.message === "BILLING_FORBIDDEN") {
      return error("Only billing users can access the billing queue", 403);
    }
    return serverError(err);
  }
});
