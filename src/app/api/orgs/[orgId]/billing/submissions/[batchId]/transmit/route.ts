import { NextRequest } from "next/server";
import { z } from "zod";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { transmitClaimBatch } from "@/lib/clearinghouse";
import { getSubmissionBatchExport } from "@/lib/claim-submission";

export const dynamic = "force-dynamic";

const transmitSchema = z.object({
  transport: z.enum(["file", "sftp", "http"]).optional(),
});

export const POST = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      const body = await req.json().catch(() => ({}));
      const parsed = transmitSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const existing = await getSubmissionBatchExport(
        auth.orgId!,
        ctx.params.batchId,
      );
      if (!existing) return notFound("Submission batch");

      const { batch, exportCsv, transport } = await transmitClaimBatch(
        auth.orgId!,
        ctx.params.batchId,
        parsed.data,
      );

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "updated",
        resourceType: "claim_batch",
        resourceId: batch.id,
        metadata: {
          transportMode: batch.transportMode,
          transportStatus: batch.transportStatus,
          clearinghouseRef: batch.clearinghouseRef,
        },
        req,
      });

      return success({ batch, exportCsv, transport });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "BATCH_NOT_FOUND") return notFound("Submission batch");
        const batch = (err as Error & { batch?: unknown }).batch;
        if (batch) {
          return error(err.message, 422, { batch });
        }
        return error(err.message, 422);
      }
      return serverError(err);
    }
  },
  { permission: "billing:manage" },
);
