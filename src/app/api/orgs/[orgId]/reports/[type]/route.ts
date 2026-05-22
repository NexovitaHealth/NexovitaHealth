import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { error, success, serverError } from "@/lib/api-response";
import { getOrgReport, parseReportType } from "@/lib/reports";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
  try {
    const reportType = parseReportType(ctx.params.type);
    if (!reportType) return error("Unsupported report type", 400);
    const range = req.nextUrl.searchParams.get("range") || "30d";

    const { summary, chartData } = await getOrgReport(
      auth.orgId!,
      reportType,
      range,
    );
    return success({ summary, chartData });
  } catch (err) {
    return serverError(err);
  }
},
  { permission: "report:view" },
);
