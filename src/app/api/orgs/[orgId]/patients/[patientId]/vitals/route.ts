import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  success,
  created,
  validationError,
  serverError,
  notFound,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { AuditAction } from "@/types";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req, ctx, auth) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: ctx.params.patientId, orgId: auth.orgId!, deletedAt: null },
    });
    if (!patient) return notFound("Patient");

    const limit = Math.min(
      100,
      parseInt(req.nextUrl.searchParams.get("limit") || "20"),
    );
    const vitals = await prisma.patientVital.findMany({
      where: { patientId: patient.id },
      orderBy: { recordedAt: "desc" },
      take: limit,
      include: { recordedBy: { select: { fullName: true, role: true } } },
    });
    return success(vitals);
  } catch (err) {
    return serverError(err);
  }
});

const vitalSchema = z.object({
  systolicBp: z.number().int().min(40).max(300).optional(),
  diastolicBp: z.number().int().min(20).max(200).optional(),
  heartRate: z.number().int().min(20).max(300).optional(),
  respiratoryRate: z.number().int().min(4).max(60).optional(),
  temperature: z.number().min(30).max(45).optional(),
  oxygenSaturation: z.number().int().min(50).max(100).optional(),
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  bloodGlucose: z.number().positive().optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  notes: z.string().max(1000).optional(),
  recordedAt: z.string().optional(),
});

export const POST = withOrgAccess(async (req, ctx, auth) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: ctx.params.patientId, orgId: auth.orgId!, deletedAt: null },
    });
    if (!patient) return notFound("Patient");

    const body = await req.json();
    const parsed = vitalSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const vital = await prisma.patientVital.create({
      data: {
        ...parsed.data,
        patientId: patient.id,
        recordedById: auth.userId,
        recordedAt: parsed.data.recordedAt
          ? new Date(parsed.data.recordedAt)
          : new Date(),
      },
    });

    // Check for critical thresholds and create alerts
    const alertsToCreate = [];
    if (parsed.data.systolicBp && parsed.data.systolicBp > 180) {
      alertsToCreate.push({
        title: "Critical: Hypertensive Crisis",
        body: `Systolic BP ${parsed.data.systolicBp} mmHg — immediate intervention required`,
        severity: "critical" as const,
      });
    }
    if (parsed.data.oxygenSaturation && parsed.data.oxygenSaturation < 90) {
      alertsToCreate.push({
        title: "Critical: Low Oxygen Saturation",
        body: `SpO2 ${parsed.data.oxygenSaturation}% — below safe threshold`,
        severity: "critical" as const,
      });
    }
    if (
      parsed.data.heartRate &&
      (parsed.data.heartRate > 120 || parsed.data.heartRate < 50)
    ) {
      alertsToCreate.push({
        title: "Warning: Abnormal Heart Rate",
        body: `Heart rate ${parsed.data.heartRate} bpm`,
        severity: "warning" as const,
      });
    }

    for (const alert of alertsToCreate) {
      await prisma.clinicalAlert.create({
        data: {
          patientId: patient.id,
          vitalId: vital.id,
          alertType: "vital_threshold",
          ...alert,
        },
      });
    }

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "vital",
      resourceId: vital.id,
      patientId: patient.id,
      metadata: { vitalId: vital.id, alertsCreated: alertsToCreate.length },
      req,
    });

    return created({ vital, alerts: alertsToCreate });
  } catch (err) {
    return serverError(err);
  }
});
