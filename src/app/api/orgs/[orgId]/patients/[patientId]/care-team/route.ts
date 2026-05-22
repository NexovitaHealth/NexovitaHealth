import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  created,
  error,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().min(1).max(80),
});

const removeSchema = z.object({
  userId: z.string().uuid(),
});

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const patient = await prisma.patient.findFirst({
      where: {
        id: ctx.params.patientId,
        orgId: auth.orgId!,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!patient) return notFound("Patient");

    const membership = await prisma.orgMembership.findFirst({
      where: { orgId: auth.orgId!, userId: parsed.data.userId },
    });
    if (!membership) {
      return error("User must be a member of this organization", 400);
    }

    const assignment = await prisma.patientCareTeam.upsert({
      where: {
        patientId_userId: {
          patientId: patient.id,
          userId: parsed.data.userId,
        },
      },
      create: {
        patientId: patient.id,
        userId: parsed.data.userId,
        role: parsed.data.role,
        isActive: true,
      },
      update: {
        role: parsed.data.role,
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "patient_care_team",
      resourceId: assignment.id,
      patientId: patient.id,
      metadata: {
        userId: parsed.data.userId,
        role: parsed.data.role,
      },
      req,
    });

    return created(assignment);
  } catch (err) {
    return serverError(err);
  }
});

export const DELETE = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = removeSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const patient = await prisma.patient.findFirst({
      where: {
        id: ctx.params.patientId,
        orgId: auth.orgId!,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!patient) return notFound("Patient");

    const existing = await prisma.patientCareTeam.findUnique({
      where: {
        patientId_userId: {
          patientId: patient.id,
          userId: parsed.data.userId,
        },
      },
    });
    if (!existing) return success({ removed: false });

    const updated = await prisma.patientCareTeam.update({
      where: { patientId_userId: { patientId: patient.id, userId: parsed.data.userId } },
      data: { isActive: false },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "removed",
      resourceType: "patient_care_team",
      resourceId: existing.id,
      patientId: patient.id,
      metadata: { userId: parsed.data.userId },
      req,
    });

    return success({ removed: true, assignment: updated });
  } catch (err) {
    return serverError(err);
  }
});
