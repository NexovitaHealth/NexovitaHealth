import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { error, forbidden, notFound, serverError, success } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  canPerformVisitAction,
  ensureVisitUnlocked,
  getOrgVisitOrThrow,
  getVisitSubmissionBlockers,
} from "@/lib/visits";
import { ensurePendingReviewForVisit } from "@/lib/billing";

export const dynamic = "force-dynamic";

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    const visit = await getOrgVisitOrThrow(auth.orgId!, ctx.params.visitId);
    ensureVisitUnlocked(visit);

    if (
      !canPerformVisitAction(visit, {
        userId: auth.userId,
        orgRole: auth.orgRole,
        userRole: auth.user.role,
      })
    ) {
      return forbidden("You cannot submit this visit");
    }

    if (visit.status !== "completed" || !visit.checkoutAt) {
      return error("Only checked-out visits can be submitted", 409);
    }

    const blockers = getVisitSubmissionBlockers(visit.visitTasks);
    if (!blockers.canSubmit) {
      return error(
        `${blockers.incompleteRequiredTasks} required visit task(s) must be completed before submission`,
        422,
      );
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const submittedVisit = await tx.visitLog.update({
        where: { id: visit.id },
        data: { submittedAt: now, lockedAt: now },
        include: {
          patient: { select: { id: true, fullName: true } },
          loggedBy: { select: { id: true, fullName: true } },
          visitTasks: { orderBy: { position: "asc" } },
          visitReview: true,
        },
      });
      await ensurePendingReviewForVisit(auth.orgId!, visit.id, tx);
      return submittedVisit;
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "status_changed",
      resourceType: "visit",
      resourceId: visit.id,
      patientId: visit.patientId,
      metadata: {
        submittedAt: now,
        lockedAt: now,
        evvVerified: visit.evvVerified,
      },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "VISIT_NOT_FOUND") return notFound("Visit");
      if (err.message === "VISIT_LOCKED") return error("Visit is locked", 409);
    }
    return serverError(err);
  }
});
