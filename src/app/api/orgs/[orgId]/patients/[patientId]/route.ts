import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  success,
  notFound,
  validationError,
  serverError,
  forbidden,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (_req, ctx, auth) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: ctx.params.patientId, orgId: auth.orgId!, deletedAt: null },
      include: {
        careTeam: {
          include: {
            user: {
              select: { id: true, fullName: true, role: true, avatarUrl: true },
            },
          },
        },
        vitals: { orderBy: { recordedAt: "desc" }, take: 10 },
        medications: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        carePlans: {
          where: { deletedAt: null, status: "active" },
          orderBy: { version: "desc" },
          take: 1,
          include: {
            signedBy: { select: { id: true, fullName: true, role: true } },
            physicianOrders: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
        },
        alerts: {
          where: { isResolved: false },
          orderBy: { createdAt: "desc" },
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: { select: { visitLogs: true, labOrders: true } },
      },
    });
    if (!patient) return notFound("Patient");

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "viewed",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
    });

    return success(patient);
  } catch (err) {
    return serverError(err);
  }
});

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  primaryDiagnosis: z.string().optional(),
  status: z
    .enum(["intake", "active", "on_hold", "discharged", "deceased"])
    .optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  allergies: z.array(z.string()).optional(),
  bloodType: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insuranceNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  isHomeCare: z.boolean().optional(),
  isHospice: z.boolean().optional(),
  isPalliative: z.boolean().optional(),
  whatsappEnrolled: z.boolean().optional(),
  whatsappNumber: z.string().optional(),
});

export const PATCH = withOrgAccess(async (req, ctx, auth) => {
  try {
    const existing = await prisma.patient.findFirst({
      where: { id: ctx.params.patientId, orgId: auth.orgId!, deletedAt: null },
    });
    if (!existing) return notFound("Patient");

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        dateOfBirth: parsed.data.dateOfBirth
          ? new Date(parsed.data.dateOfBirth as string)
          : undefined,
      },
    });

    const changes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if ((existing as Record<string, unknown>)[k] !== v)
        changes[k] = { from: (existing as Record<string, unknown>)[k], to: v };
    }

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: parsed.data.status ? "status_changed" : "updated",
      resourceType: "patient",
      resourceId: existing.id,
      patientId: existing.id,
      metadata: { changes },
      req,
    });

    return success(updated);
  } catch (err) {
    return serverError(err);
  }
});

export const DELETE = withOrgAccess(async (_req, ctx, auth) => {
  try {
    if (!["agency_admin", "supervisor"].includes(auth.orgRole || "")) {
      return forbidden();
    }
    const patient = await prisma.patient.findFirst({
      where: { id: ctx.params.patientId, orgId: auth.orgId!, deletedAt: null },
    });
    if (!patient) return notFound("Patient");

    await prisma.patient.update({
      where: { id: patient.id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "deleted",
      resourceType: "patient",
      resourceId: patient.id,
      patientId: patient.id,
    });

    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
});
