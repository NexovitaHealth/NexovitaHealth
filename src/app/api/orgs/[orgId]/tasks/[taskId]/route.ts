import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
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
    const task = await prisma.task.findFirst({
      where: { id: ctx.params.taskId, orgId: auth.orgId!, deletedAt: null },
      include: {
        createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
        assignees: {
          include: {
            user: {
              select: { id: true, fullName: true, avatarUrl: true, role: true },
            },
          },
        },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
        attachments: { where: { deletedAt: null } },
        column: true,
        patient: { select: { id: true, fullName: true } },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { actor: { select: { fullName: true, avatarUrl: true } } },
        },
      },
    });
    if (!task) return notFound("Task");
    return success(task);
  } catch (err) {
    return serverError(err);
  }
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled"])
    .optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  columnId: z.string().uuid().optional(),
  position: z.number().int().optional(),
  dueDate: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  completedAt: z.string().nullable().optional(),
});

export const PATCH = withOrgAccess(async (req, ctx, auth) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: ctx.params.taskId, orgId: auth.orgId!, deletedAt: null },
      include: { assignees: true },
    });
    if (!task) return notFound("Task");

    const body = await req.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { assigneeIds, ...taskData } = parsed.data;

    const updateData: Prisma.TaskUncheckedUpdateInput = {
      ...taskData,
      dueDate:
        taskData.dueDate === null
          ? null
          : taskData.dueDate
            ? new Date(taskData.dueDate)
            : undefined,
      completedAt:
        taskData.status === "completed"
          ? new Date()
          : taskData.completedAt === null
            ? null
            : undefined,
    };

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: updateData,
    });

    // Sync assignees if provided
    if (assigneeIds !== undefined) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: task.id } });
      if (assigneeIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: (assigneeIds as string[]).map((userId: string) => ({
            taskId: task.id,
            userId,
          })),
        });
      }
    }

    const action = taskData.status ? "status_changed" : "updated";
    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action,
      resourceType: "task",
      resourceId: task.id,
      taskId: task.id,
      metadata: { changes: taskData },
      req,
    });

    return success(updated);
  } catch (err) {
    return serverError(err);
  }
});

export const DELETE = withOrgAccess(async (_req, ctx, auth) => {
  try {
    if (!["owner", "admin"].includes(auth.orgRole || "")) {
      return forbidden();
    }
    const task = await prisma.task.findFirst({
      where: { id: ctx.params.taskId, orgId: auth.orgId!, deletedAt: null },
    });
    if (!task) return notFound("Task");

    await prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: new Date() },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "deleted",
      resourceType: "task",
      resourceId: task.id,
    });

    return success({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
});
