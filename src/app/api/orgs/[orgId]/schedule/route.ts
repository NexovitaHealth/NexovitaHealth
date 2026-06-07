import { NextRequest, NextResponse } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { patientBranchFilter } from "@/lib/branches";
import { prisma } from "@/lib/prisma";
import { success, serverError } from "@/lib/api-response";
import { processMissedVisitsForOrg } from "@/lib/missed-visits";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    const { orgId } = auth;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

    await processMissedVisitsForOrg(orgId);

    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const scheduledAtFilter: Record<string, Date> = {};
    if (startDate) scheduledAtFilter.gte = new Date(startDate);
    if (endDate) scheduledAtFilter.lte = new Date(endDate + "T23:59:59Z");

    const visits = await prisma.visitLog.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(Object.keys(scheduledAtFilter).length
          ? { scheduledAt: scheduledAtFilter }
          : {}),
        ...patientBranchFilter(auth.activeBranchId, auth.orgHasBranches),
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        loggedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 500,
    });

    const normalized = visits.map((v: (typeof visits)[0]) => ({
      id: v.id,
      patientId: v.patientId,
      staffId: v.loggedById,
      scheduledAt: v.scheduledAt.toISOString(),
      scheduledDate: v.scheduledAt.toISOString(),
      visitType: v.visitType,
      status: v.status,
      notes: v.notes,
      serviceAddress: v.serviceAddress,
      checkinAt: v.checkinAt,
      checkoutAt: v.checkoutAt,
      evvVerified: v.evvVerified,
      lockedAt: v.lockedAt,
      patient: v.patient,
      caregiver: v.loggedBy,
    }));

    return success(normalized);
  } catch (err) {
    console.error(err);
    return serverError(err);
  }
});
