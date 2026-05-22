import { NextRequest } from "next/server";
import type { AlertSeverity } from "@prisma/client";
import { withOrgAccess } from "@/lib/middleware";
import { NextResponse } from "next/server";
import { serverError } from "@/lib/api-response";
import { getPagination } from "@/lib/pagination";
import { listOrgClinicalAlerts } from "@/lib/clinical-alerts";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const { page, pageSize } = getPagination(req, 50);
      const resolved =
        (req.nextUrl.searchParams.get("resolved") as "true" | "false" | "all") ||
        "false";
      const severity = req.nextUrl.searchParams.get("severity") as
        | AlertSeverity
        | null;
      const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
      const alertType = req.nextUrl.searchParams.get("alertType") || undefined;

      const { items, total, openCritical } = await listOrgClinicalAlerts(
        auth.orgId!,
        {
          page,
          pageSize,
          resolved,
          severity: severity ?? undefined,
          patientId,
          alertType,
        },
      );

      return NextResponse.json({
        success: true,
        data: items,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
          hasMore: page * pageSize < total,
        },
        meta: { openCritical },
      });
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "alert:read" },
);
