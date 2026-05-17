import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  success,
  created,
  paginated,
  validationError,
  serverError,
  forbidden,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
// Types imported inline
import { getPagination, getSearchParams } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req, _ctx, auth) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req);
    const { search, status, priority, assigneeId, sortBy, sortOrder } =
      getSearchParams(req);
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const label = req.nextUrl.searchParams.get("label") || undefined;

    const where: Prisma.TaskWhereInput = {
      orgId: auth.orgId!,
      deletedAt: null,
      ...(projectId && { projectId }),
      ...(status && { status: status as TaskStatus }),
      ...(priority && { priority: priority as TaskPriority }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { description: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(assigneeId && { assignees: { some: { userId: assigneeId } } }),
    };

    const validSortFields = [
      "createdAt",
      "updatedAt",
      "dueDate",
      "priority",
      "title",
    ];
    const orderByField = validSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: { [orderByField]: sortOrder },
        include: {
          createdBy: { select: { id: true, fullName: true, avatarUrl: true } },
          assignees: {
            include: {
              user: { select: { id: true, fullName: true, avatarUrl: true } },
            },
          },
          column: { select: { id: true, name: true } },
          patient: { select: { id: true, fullName: true } },
          _count: { select: { comments: true, attachments: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return paginated(tasks, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  projectId: z.string().uuid().optional(),
  columnId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
  dueDate: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});

export const POST = withOrgAccess(async (req, _ctx, auth) => {
  try {
    if (auth.orgRole === "guest")
      return forbidden("Guests cannot create tasks");

    const body = await req.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // Get max position in column for kanban ordering
    const maxPosition = await prisma.task.aggregate({
      where: { columnId: parsed.data.columnId, deletedAt: null },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        orgId: auth.orgId!,
        title: parsed.data.title,
        description: parsed.data.description,
        projectId: parsed.data.projectId,
        columnId: parsed.data.columnId,
        patientId: parsed.data.patientId,
        priority: parsed.data.priority,
        dueDate: parsed.data.dueDate
          ? new Date(parsed.data.dueDate as string)
          : undefined,
        labels: parsed.data.labels ?? [],
        position: (maxPosition._max.position ?? 0) + 1,
        createdById: auth.userId,
        status: "pending",
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        column: { select: { id: true, name: true } },
      },
    });

    // Add assignees
    if (parsed.data.assigneeIds?.length) {
      await prisma.taskAssignee.createMany({
        data: parsed.data.assigneeIds!.map((userId: string) => ({
          taskId: task.id,
          userId,
        })),
      });
    }

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "task",
      resourceId: task.id,
      taskId: task.id,
      metadata: { title: task.title },
      req,
    });

    return created(task);
  } catch (err) {
    return serverError(err);
  }
});
