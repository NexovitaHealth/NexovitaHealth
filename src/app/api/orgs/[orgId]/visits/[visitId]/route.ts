import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  forbidden,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  canPerformVisitAction,
  ensureVisitUnlocked,
  getOrgVisitOrThrow,
} from "@/lib/visits";

export const dynamic = "force-dynamic";

const updateVisitSchema = z.object({
  visitType: z.string().min(1).max(100).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z
    .enum(["scheduled", "in_progress", "completed", "missed", "cancelled"])
    .optional(),
  notes: z.string().max(2000).optional(),
  serviceAddress: z.string().max(500).optional(),
  serviceLatitude: z.number().min(-90).max(90).nullable().optional(),
  serviceLongitude: z.number().min(-180).max(180).nullable().optional(),
});

export const GET = withOrgAccess(
  async (_req: NextRequest, ctx, auth) => {
    try {
      const visit = await getOrgVisitOrThrow(auth.orgId!, ctx.params.visitId);
      return success(visit);
    } catch (err) {
      if (err instanceof Error && err.message === "VISIT_NOT_FOUND") {
        return notFound("Visit");
      }
      return serverError(err);
    }
  },
  { permission: "visit:read" },
);

export const PATCH = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    const visit = await getOrgVisitOrThrow(auth.orgId!, ctx.params.visitId);
    ensureVisitUnlocked(visit);

    if (
      !canPerformVisitAction(visit, {
        userId: auth.userId,
        orgRole: auth.orgRole,
        userRole: auth.user.role,
      })
    ) {
      return forbidden("You cannot update this visit");
    }

    const body = await req.json();
    const parsed = updateVisitSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.visitLog.update({
      where: { id: visit.id },
      data: {
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt
          ? new Date(parsed.data.scheduledAt)
          : undefined,
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        loggedBy: { select: { id: true, fullName: true } },
        visitTasks: { orderBy: { position: "asc" } },
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: parsed.data.status ? "status_changed" : "updated",
      resourceType: "visit",
      resourceId: visit.id,
      patientId: visit.patientId,
      metadata: { changes: parsed.data },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "VISIT_NOT_FOUND") return notFound("Visit");
      if (err.message === "VISIT_LOCKED") return error("Visit is locked", 409);
    }
    return serverError(err);
  }
});
