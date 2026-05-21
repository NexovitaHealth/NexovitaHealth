import { randomUUID } from "node:crypto";
import type { ClaimStatus, Prisma, VisitReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReviewDecisionInput = {
  status: Exclude<VisitReviewStatus, "pending">;
  clinicalNotes?: string;
  correctionReason?: string;
  billingHoldReason?: string;
};

export type CreateClaimInput = {
  visitId: string;
  serviceCode: string;
  totalAmount?: number;
  units?: number;
  diagnosisCodes?: string[];
  procedureCodes?: string[];
  authorisationId?: string;
};

export function makeClaimNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CLM-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function assertClinicalReviewer(role: string) {
  if (!["agency_admin", "supervisor", "physician"].includes(role)) {
    throw new Error("REVIEW_FORBIDDEN");
  }
}

export function assertBillingUser(role: string) {
  if (!["agency_admin", "billing_manager"].includes(role)) {
    throw new Error("BILLING_FORBIDDEN");
  }
}

export async function ensurePendingReviewForVisit(
  orgId: string,
  visitId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const visit = await client.visitLog.findFirst({
    where: { id: visitId, orgId, deletedAt: null },
    select: {
      id: true,
      orgId: true,
      patientId: true,
      status: true,
      submittedAt: true,
      lockedAt: true,
    },
  });
  if (!visit) throw new Error("VISIT_NOT_FOUND");
  if (visit.status !== "completed" || !visit.submittedAt || !visit.lockedAt) {
    throw new Error("VISIT_NOT_SUBMITTED");
  }

  return client.visitReview.upsert({
    where: { visitLogId: visit.id },
    update: {},
    create: {
      orgId: visit.orgId,
      patientId: visit.patientId,
      visitLogId: visit.id,
    },
  });
}

export async function applyVisitReviewDecision(
  orgId: string,
  visitId: string,
  reviewedById: string,
  input: ReviewDecisionInput,
) {
  return prisma.$transaction(async (tx) => {
    const review = await ensurePendingReviewForVisit(orgId, visitId, tx);
    if (review.status === "approved" && input.status !== "approved") {
      const claim = await tx.claim.findFirst({
        where: { orgId, visitLogId: visitId, deletedAt: null },
        select: { id: true },
      });
      if (claim) throw new Error("CLAIM_ALREADY_EXISTS");
    }

    return tx.visitReview.update({
      where: { id: review.id },
      data: {
        status: input.status,
        reviewedById,
        reviewedAt: new Date(),
        clinicalNotes: input.clinicalNotes,
        correctionReason:
          input.status === "needs_correction" || input.status === "rejected"
            ? input.correctionReason
            : null,
        billingHoldReason:
          input.status === "approved" ? input.billingHoldReason ?? null : null,
      },
      include: reviewInclude,
    });
  });
}

export const reviewInclude = {
  patient: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true, role: true } },
  visitLog: {
    include: {
      loggedBy: { select: { id: true, fullName: true, role: true } },
      visitTasks: { orderBy: { position: "asc" } },
      claim: true,
    },
  },
} satisfies Prisma.VisitReviewInclude;

export const claimInclude = {
  patient: { select: { id: true, fullName: true, insuranceProvider: true } },
  visitLog: {
    select: {
      id: true,
      visitType: true,
      scheduledAt: true,
      submittedAt: true,
      evvVerified: true,
      evvFlagReason: true,
      durationMinutes: true,
    },
  },
  authorisation: true,
  createdBy: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.ClaimInclude;

export async function findActiveAuthorisation(
  orgId: string,
  patientId: string,
  serviceCode: string,
  serviceDate: Date,
  units: number,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  return client.payerAuthorisation.findFirst({
    where: {
      orgId,
      patientId,
      status: "active",
      deletedAt: null,
      startDate: { lte: serviceDate },
      endDate: { gte: serviceDate },
      OR: [{ serviceCode }, { serviceCode: null }],
      unitsAuthorised: { gt: 0 },
    },
    orderBy: [{ serviceCode: "desc" }, { endDate: "asc" }],
  }).then((authorisation) => {
    if (!authorisation) return null;
    const remaining = authorisation.unitsAuthorised - authorisation.unitsUsed;
    return remaining >= units ? authorisation : null;
  });
}

export async function createClaimFromApprovedVisit(
  orgId: string,
  createdById: string,
  input: CreateClaimInput,
) {
  return prisma.$transaction(async (tx) => {
    const visit = await tx.visitLog.findFirst({
      where: { id: input.visitId, orgId, deletedAt: null },
      include: {
        patient: { select: { id: true, insuranceProvider: true } },
        visitReview: true,
        claim: true,
      },
    });
    if (!visit) throw new Error("VISIT_NOT_FOUND");
    if (visit.status !== "completed" || !visit.submittedAt || !visit.lockedAt) {
      throw new Error("VISIT_NOT_SUBMITTED");
    }
    if (visit.visitReview?.status !== "approved") {
      throw new Error("VISIT_NOT_APPROVED");
    }
    if (visit.claim) throw new Error("CLAIM_ALREADY_EXISTS");

    const units = input.units ?? 1;
    const serviceDate = visit.checkoutAt ?? visit.scheduledAt;
    const authorisation = input.authorisationId
      ? await tx.payerAuthorisation.findFirst({
          where: {
            id: input.authorisationId,
            orgId,
            patientId: visit.patientId,
            deletedAt: null,
          },
        })
      : await findActiveAuthorisation(
          orgId,
          visit.patientId,
          input.serviceCode,
          serviceDate,
          units,
          tx,
        );

    if (!authorisation) throw new Error("AUTHORISATION_NOT_FOUND");
    if (authorisation.status !== "active") throw new Error("AUTHORISATION_INACTIVE");
    if (
      authorisation.startDate > serviceDate ||
      authorisation.endDate < serviceDate
    ) {
      throw new Error("AUTHORISATION_OUT_OF_RANGE");
    }
    if (
      authorisation.serviceCode &&
      authorisation.serviceCode !== input.serviceCode
    ) {
      throw new Error("AUTHORISATION_SERVICE_MISMATCH");
    }
    if (authorisation.unitsAuthorised - authorisation.unitsUsed < units) {
      throw new Error("AUTHORISATION_EXHAUSTED");
    }

    const claim = await tx.claim.create({
      data: {
        orgId,
        patientId: visit.patientId,
        visitLogId: visit.id,
        authorisationId: authorisation.id,
        createdById,
        claimNumber: makeClaimNumber(),
        status: "queued",
        queuedAt: new Date(),
        payerName: authorisation.payerName,
        serviceCode: input.serviceCode,
        serviceDate,
        units,
        unitType: authorisation.unitType,
        totalAmount: input.totalAmount ?? 0,
        diagnosisCodes: input.diagnosisCodes ?? [],
        procedureCodes: input.procedureCodes ?? [],
        metadata: {
          source: "approved_visit",
          evvVerified: visit.evvVerified,
          evvFlagReason: visit.evvFlagReason,
        },
      },
      include: claimInclude,
    });

    await tx.payerAuthorisation.update({
      where: { id: authorisation.id },
      data: {
        unitsUsed: { increment: units },
        status:
          authorisation.unitsUsed + units >= authorisation.unitsAuthorised
            ? "exhausted"
            : authorisation.status,
      },
    });

    return claim;
  });
}

export function getClaimStatusTimestamps(status: ClaimStatus) {
  const now = new Date();
  return {
    submittedAt: status === "submitted" ? now : undefined,
    paidAt: status === "paid" ? now : undefined,
    deniedAt: status === "denied" ? now : undefined,
    voidedAt: status === "voided" ? now : undefined,
  };
}
