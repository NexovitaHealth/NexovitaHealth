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
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    // Get all patients in this org first
    const patients = await prisma.patient.findMany({
      where: { orgId, status: "active", deletedAt: null },
      select: { id: true },
    });
    const patientIds = patients.map((p: { id: string }) => p.id);

    const where: Record<string, unknown> = {
      patientId: { in: patientIds },
    };
    if (status) where.status = status;
    if (search) {
      where.panelName = { contains: search, mode: "insensitive" };
    }

    const labs = await prisma.labOrder.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true } },
        results: {
          select: {
            id: true,
            componentName: true,
            value: true,
            unit: true,
            referenceMin: true,
            referenceMax: true,
            isAbnormal: true,
            isCritical: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Shape results for frontend
    const shaped = labs.map((lab: (typeof labs)[0]) => ({
      ...lab,
      testName: lab.panelName,
      orderedAt: lab.createdAt,
      resultDate: lab.resultedAt,
      criticalValues:
        lab.results
          .filter(
            (r: {
              isCritical: boolean;
              componentName: string;
              value: string;
              unit: string | null;
            }) => r.isCritical,
          )
          .map(
            (r: {
              componentName: string;
              value: string;
              unit: string | null;
              referenceMin: string | null;
              referenceMax: string | null;
              isAbnormal: boolean;
              isCritical: boolean;
              id: string;
            }) => `${r.componentName}: ${r.value} ${r.unit}`,
          )
          .join(", ") || null,
      results: lab.results.map(
        (r: {
          componentName: string;
          value: string;
          unit: string | null;
          referenceMin: string | null;
          referenceMax: string | null;
          isAbnormal: boolean;
        }) => ({
          component: r.componentName,
          value: r.value,
          unit: r.unit || "",
          referenceRange:
            r.referenceMin && r.referenceMax
              ? `${r.referenceMin} – ${r.referenceMax}`
              : undefined,
          isAbnormal: r.isAbnormal,
        }),
      ),
    }));

    return success(shaped);
  } catch (err) {
    console.error(err);
    return serverError(err);
  }
});
