import { NextRequest } from "next/server";
import { z } from "zod";
import { withOrgAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  error,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { getOrgPatientOrThrow } from "@/lib/visits";

export const dynamic = "force-dynamic";

const createLabSchema = z.object({
  patientId: z.string().uuid(),
  panelName: z.string().min(1).max(200),
  priority: z.enum(["routine", "urgent", "stat"]).default("routine"),
  notes: z.string().max(2000).optional(),
});

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    const orgId = auth.orgId!;

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

export const POST = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = createLabSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const patient = await getOrgPatientOrThrow(
      auth.orgId!,
      parsed.data.patientId,
    );

    const order = await prisma.labOrder.create({
      data: {
        patientId: patient.id,
        orderedById: auth.userId,
        panelName: parsed.data.panelName,
        priority: parsed.data.priority,
        notes: parsed.data.notes,
        status: "ordered",
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        results: true,
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "lab_order",
      resourceId: order.id,
      patientId: patient.id,
      metadata: { panelName: order.panelName, priority: order.priority },
      req,
    });

    return created({
      ...order,
      testName: order.panelName,
      orderedAt: order.createdAt,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "PATIENT_NOT_FOUND") {
      return notFound("Patient");
    }
    return serverError(err);
  }
});
