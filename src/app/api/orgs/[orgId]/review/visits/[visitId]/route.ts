import { NextRequest } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { error, notFound, serverError, success, validationError } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  applyVisitReviewDecision,
  assertClinicalReviewer,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const reviewDecisionSchema = z.object({
  status: z.enum(["approved", "needs_correction", "rejected"]),
  clinicalNotes: z.string().max(2000).optional(),
  correctionReason: z.string().max(1000).optional(),
  billingHoldReason: z.string().max(1000).optional(),
});

export const PATCH = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertClinicalReviewer(auth.user.role);

    const body = await req.json();
    const parsed = reviewDecisionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    if (
      (parsed.data.status === "needs_correction" ||
        parsed.data.status === "rejected") &&
      !parsed.data.correctionReason
    ) {
      return error("A correction reason is required for this review decision", 422);
    }

    const review = await applyVisitReviewDecision(
      auth.orgId!,
      ctx.params.visitId,
      auth.userId,
      parsed.data,
    );

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "status_changed",
      resourceType: "visit_review",
      resourceId: review.id,
      patientId: review.patientId,
      metadata: {
        visitId: review.visitLogId,
        status: review.status,
      },
      req,
    });

    return success(review);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "REVIEW_FORBIDDEN") {
        return error("Only clinical reviewers can decide visit reviews", 403);
      }
      if (err.message === "VISIT_NOT_FOUND") return notFound("Visit");
      if (err.message === "VISIT_NOT_SUBMITTED") {
        return error("Visit must be submitted and locked before nurse review", 409);
      }
      if (err.message === "CLAIM_ALREADY_EXISTS") {
        return error("A claim already exists for this approved visit", 409);
      }
    }
    return serverError(err);
  }
});
