import { NextRequest, NextResponse } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import { error, serverError } from "@/lib/api-response";
import {
  getOrgReport,
  getReportExportColumns,
  parseReportType,
  toCsv,
} from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    const reportType = parseReportType(ctx.params.type);
    if (!reportType) return error("Unsupported report type", 400);

    const range = req.nextUrl.searchParams.get("range") || "30d";
    const report = await getOrgReport(auth.orgId!, reportType, range);
    const csv = toCsv(report.exportRows, getReportExportColumns(reportType));

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "exported",
      resourceType: "report",
      resourceId: reportType,
      metadata: { reportType, range, format: "csv", rows: report.exportRows.length },
      req,
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nexovita-${reportType}-${range}.csv"`,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
