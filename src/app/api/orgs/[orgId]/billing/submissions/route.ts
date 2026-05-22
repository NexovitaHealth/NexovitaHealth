import { NextRequest } from "next/server";
import { z } from "zod";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { assertBillingUser } from "@/lib/billing";
import { submitClaimBatch } from "@/lib/claim-submission";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const submitSchema = z.object({
  claimIds: z.array(z.string().uuid()).optional(),
  payerName: z.string().max(200).optional(),
});

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    assertBillingUser(auth);

    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
    const pageSize = Math.min(
      50,
      Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") || 20)),
    );

    const batches = await prisma.claimSubmissionBatch.findMany({
      where: { orgId: auth.orgId! },
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        submittedBy: { select: { id: true, fullName: true } },
        _count: { select: { claims: true } },
      },
    });

    return success(batches);
  } catch (err) {
    if (err instanceof Error && err.message === "BILLING_FORBIDDEN") {
      return error("Only billing users can view submission batches", 403);
    }
    return serverError(err);
  }
});

export const POST = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    assertBillingUser(auth);

    const body = await req.json().catch(() => ({}));
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { batch, exportCsv } = await submitClaimBatch(
      auth.orgId!,
      auth.userId,
      parsed.data,
    );

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "exported",
      resourceType: "claim_batch",
      resourceId: batch.id,
      metadata: {
        batchNumber: batch.batchNumber,
        claimCount: batch.claimCount,
        clearinghouseRef: batch.clearinghouseRef,
      },
      req,
    });

    return success({
      batch,
      exportCsv,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "BILLING_FORBIDDEN") {
        return error("Only billing users can submit claim batches", 403);
      }
      if (err.message === "NO_CLAIMS_TO_SUBMIT") {
        return error("No queued claims available for submission", 422);
      }
    }
    return serverError(err);
  }
});
