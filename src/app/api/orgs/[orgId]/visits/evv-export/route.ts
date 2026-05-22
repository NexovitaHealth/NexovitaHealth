import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { error, serverError } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { buildEvvExportCsv, type EvvExportRow } from "@/lib/evv-export";

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

    const scheduledAt: { gte?: Date; lte?: Date } = {};
    if (startDate) scheduledAt.gte = new Date(startDate);
    if (endDate) scheduledAt.lte = new Date(`${endDate}T23:59:59Z`);

    const visits = await prisma.visitLog.findMany({
      where: {
        orgId: auth.orgId!,
        deletedAt: null,
        status: { in: ["completed", "in_progress"] },
        checkinAt: { not: null },
        ...(verifiedOnly && { evvVerified: true }),
        ...(Object.keys(scheduledAt).length ? { scheduledAt } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      take: 5000,
      include: {
        patient: { select: { fullName: true } },
        loggedBy: { select: { fullName: true } },
      },
    });

    const rows: EvvExportRow[] = visits.map((v) => ({
      visit: v,
      patient: v.patient,
      staff: v.loggedBy,
    }));

    const csv = buildEvvExportCsv(rows);
    const filename = `evv-export-${auth.orgId!.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "exported",
      resourceType: "visit",
      metadata: {
        format: "evv_csv",
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
