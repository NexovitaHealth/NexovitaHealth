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

const updateVisitTaskSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped", "refused"]),
  notes: z.string().max(1000).optional(),
});

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
      return forbidden("You cannot update tasks for this visit");
    }

    const body = await req.json();
    const parsed = updateVisitTaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const task = await prisma.visitTask.findFirst({
      where: {
        id: ctx.params.taskId,
        visitLogId: visit.id,
        orgId: auth.orgId!,
      },
    });
    if (!task) return notFound("Visit task");

    const isCompleted = parsed.data.status === "completed";
    const updated = await prisma.visitTask.update({
      where: { id: task.id },
      data: {
        status: parsed.data.status,
        notes: parsed.data.notes,
        completedAt: isCompleted ? new Date() : null,
        completedById: isCompleted ? auth.userId : null,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        completedBy: { select: { id: true, fullName: true } },
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "updated",
      resourceType: "visit_task",
      resourceId: task.id,
      patientId: visit.patientId,
      metadata: {
        visitId: visit.id,
        status: parsed.data.status,
      },
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
