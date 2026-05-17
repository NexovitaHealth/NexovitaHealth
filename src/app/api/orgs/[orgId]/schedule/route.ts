import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { success, serverError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: NextRequest, ctx, auth) => {
  try {
    const { orgId } = auth;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

    const { searchParams } = req.nextUrl;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const orgPatients = await prisma.patient.findMany({
      where: { orgId, status: "active", deletedAt: null },
      select: { id: true },
    });
    const patientIds = orgPatients.map((p: { id: string }) => p.id);

    const scheduledAtFilter: Record<string, Date> = {};
    if (startDate) scheduledAtFilter.gte = new Date(startDate);
    if (endDate) scheduledAtFilter.lte = new Date(endDate + "T23:59:59Z");

    const visits = await prisma.visitLog.findMany({
      where: {
        patientId: { in: patientIds },
        deletedAt: null,
        ...(Object.keys(scheduledAtFilter).length
          ? { scheduledAt: scheduledAtFilter }
          : {}),
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
      scheduledDate: v.scheduledAt,
      visitType: v.visitType,
      status: v.status,
      notes: v.notes,
      patient: v.patient,
      caregiver: v.loggedBy,
    }));

    return success(normalized);
  } catch (err) {
    console.error(err);
    return serverError(err);
  }
});
