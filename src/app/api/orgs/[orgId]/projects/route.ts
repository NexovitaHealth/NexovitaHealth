import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  success,
  created,
  validationError,
  serverError,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { AuditAction } from "@/types";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (_req, _ctx, auth) => {
  try {
    const projects = await prisma.project.findMany({
      where: { orgId: auth.orgId!, deletedAt: null },
      include: {
        columns: { orderBy: { position: "asc" } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return success(projects);
  } catch (err) {
    return serverError(err);
  }
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const POST = withOrgAccess(async (req, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const project = await prisma.project.create({
      data: {
        orgId: auth.orgId!,
        name: parsed.data.name,
        description: parsed.data.description,
        color: parsed.data.color ?? "#028090",
        createdById: auth.userId,
        columns: {
          create: [
            { name: "Backlog", position: 0, color: "#94a3b8" },
            { name: "In Progress", position: 1, color: "#3b82f6" },
            { name: "Review", position: 2, color: "#f59e0b" },
            { name: "Done", position: 3, color: "#22c55e" },
          ],
        },
      },
      include: { columns: true },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "project",
      resourceId: project.id,
      metadata: { name: project.name },
      req,
    });

    return created(project);
  } catch (err) {
    return serverError(err);
  }
});
