import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  error,
  paginated,
  serverError,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  ensureOrgMember,
  getOrgPatientOrThrow,
} from "@/lib/visits";
import { getPagination } from "@/lib/pagination";
import { processMissedVisitsForOrg } from "@/lib/missed-visits";

export const dynamic = "force-dynamic";

const visitTaskSchema = z.object({
  title: z.string().min(1).max(200),
  instructions: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  required: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  assignedToId: z.string().uuid().optional(),
});

const createVisitSchema = z.object({
  patientId: z.string().uuid(),
  staffId: z.string().uuid(),
  visitType: z.string().min(1).max(100),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
  serviceAddress: z.string().max(500).optional(),
  serviceLatitude: z.number().min(-90).max(90).optional(),
  serviceLongitude: z.number().min(-180).max(180).optional(),
  tasks: z.array(visitTaskSchema).optional(),
});

export const GET = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    await processMissedVisitsForOrg(auth.orgId!);

    const { skip, take, page, pageSize } = getPagination(req, 50);
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const staffId = req.nextUrl.searchParams.get("staffId") || undefined;
    const patientId = req.nextUrl.searchParams.get("patientId") || undefined;
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    const scheduledAt: { gte?: Date; lte?: Date } = {};
    if (startDate) scheduledAt.gte = new Date(startDate);
    if (endDate) scheduledAt.lte = new Date(`${endDate}T23:59:59Z`);

    const where = {
      orgId: auth.orgId!,
      deletedAt: null,
      ...(status && { status: status as "scheduled" }),
      ...(staffId && { loggedById: staffId }),
      ...(patientId && { patientId }),
      ...(Object.keys(scheduledAt).length ? { scheduledAt } : {}),
    };

    const [visits, total] = await Promise.all([
      prisma.visitLog.findMany({
        where,
        skip,
        take,
        orderBy: { scheduledAt: "asc" },
        include: {
          patient: { select: { id: true, fullName: true, address: true } },
          loggedBy: { select: { id: true, fullName: true, role: true } },
          visitTasks: { orderBy: { position: "asc" } },
        },
      }),
      prisma.visitLog.count({ where }),
    ]);

    return paginated(visits, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
});

export const POST = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = createVisitSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const data = parsed.data;
    const visit = await prisma.$transaction(async (tx) => {
      const patient = await getOrgPatientOrThrow(auth.orgId!, data.patientId, tx);
      await ensureOrgMember(auth.orgId!, data.staffId, tx);

      const serviceLatitude = data.serviceLatitude ?? patient.latitude ?? undefined;
      const serviceLongitude =
        data.serviceLongitude ?? patient.longitude ?? undefined;

      const createdVisit = await tx.visitLog.create({
        data: {
          orgId: auth.orgId!,
          patientId: patient.id,
          loggedById: data.staffId,
          visitType: data.visitType,
          scheduledAt: new Date(data.scheduledAt),
          notes: data.notes,
          serviceAddress: data.serviceAddress ?? patient.address ?? undefined,
          serviceLatitude,
          serviceLongitude,
          visitTasks: data.tasks?.length
            ? {
                create: data.tasks.map((task, index) => ({
                  orgId: auth.orgId!,
                  patientId: patient.id,
                  assignedToId: task.assignedToId ?? data.staffId,
                  title: task.title,
                  instructions: task.instructions,
                  category: task.category,
                  required: task.required ?? true,
                  position: task.position ?? index,
                })),
              }
            : undefined,
        },
        include: {
          patient: { select: { id: true, fullName: true } },
          loggedBy: { select: { id: true, fullName: true } },
          visitTasks: { orderBy: { position: "asc" } },
        },
      });

      return createdVisit;
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "visit",
      resourceId: visit.id,
      patientId: visit.patientId,
      metadata: {
        visitType: visit.visitType,
        scheduledAt: visit.scheduledAt,
        taskCount: visit.visitTasks.length,
      },
      req,
    });

    return created(visit);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PATIENT_NOT_FOUND") {
        return error("Patient is not available in this organization", 404);
      }
      if (err.message === "STAFF_NOT_IN_ORG") {
        return error("Assigned staff must belong to this organization", 400);
      }
    }
    return serverError(err);
  }
});
