import { NextRequest, NextResponse } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import { notFound, serverError } from "@/lib/api-response";
import { getSubmissionBatchExport } from "@/lib/claim-submission";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
    try {
      const result = await getSubmissionBatchExport(
        auth.orgId!,
        ctx.params.batchId,
      );
      if (!result) return notFound("Submission batch");

      await createAuditLog({
        orgId: auth.orgId,
        actorId: auth.userId,
        action: "exported",
        resourceType: "claim_batch",
        resourceId: result.batch.id,
        metadata: { batchNumber: result.batch.batchNumber, format: "837-csv" },
        req,
      });

      return new NextResponse(result.exportCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="837-${result.batch.batchNumber}.csv"`,
        },
      });
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "billing:export" },
);
