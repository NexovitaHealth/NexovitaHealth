import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { error, serverError } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  buildEvvExportCsv,
  fetchEvvExportRows,
} from "@/lib/evv-export";
import {
  buildMedicaidEvvCsv,
  parseMedicaidEvvConfig,
  validateMedicaidEvvConfig,
} from "@/lib/evv-medicaid";

export const dynamic = "force-dynamic";

const EXPORT_ROLES = [
  "agency_admin",
  "supervisor",
  "billing_manager",
  "physician",
  "physician_independent",
];

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    if (!EXPORT_ROLES.includes(auth.user.role)) {
      return error("You cannot export EVV data", 403);
    }

    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");
    const verifiedOnly =
      req.nextUrl.searchParams.get("verifiedOnly") !== "false";
    const format = req.nextUrl.searchParams.get("format") || "standard";

    const [org, settings, rows] = await Promise.all([
      prisma.organization.findFirst({
        where: { id: auth.orgId!, deletedAt: null },
        select: { npiNumber: true, region: true },
      }),
      prisma.orgSettings.findUnique({
        where: { orgId: auth.orgId! },
        select: { features: true },
      }),
      fetchEvvExportRows(prisma, auth.orgId!, {
        startDate,
        endDate,
        verifiedOnly,
      }),
    ]);

    const medicaidConfig = parseMedicaidEvvConfig(settings?.features);
    const context = {
      orgId: auth.orgId!,
      orgNpi: org?.npiNumber,
      orgRegion: org?.region,
    };

    let csv: string;
    let formatKey: string;
    let filename: string;

    if (format === "medicaid") {
      const validation = validateMedicaidEvvConfig(
        medicaidConfig,
        org?.npiNumber,
      );
      if (!validation.ok) {
        return error(validation.error, 422);
      }
      csv = buildMedicaidEvvCsv(rows, medicaidConfig, context);
      formatKey = "medicaid_evv_sandata_csv";
      const state = medicaidConfig.stateCode || "us";
      filename = `medicaid-evv-${state}-${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      csv = buildEvvExportCsv(rows);
      formatKey = "evv_csv";
      filename = `evv-export-${auth.orgId!.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    }

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "exported",
      resourceType: "visit",
      metadata: {
        format: formatKey,
        rowCount: rows.length,
        verifiedOnly,
        startDate,
        endDate,
      },
      req,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
