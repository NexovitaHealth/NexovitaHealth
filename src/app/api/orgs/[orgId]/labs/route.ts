import { NextRequest } from "next/server";
import { z } from "zod";
import { withOrgAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { getOrgPatientOrThrow } from "@/lib/visits";
import {
  labOrderInclude,
  orgLabWhere,
  shapeLabOrderForApi,
} from "@/lib/labs";

export const dynamic = "force-dynamic";

const createLabSchema = z.object({
  patientId: z.string().uuid(),
  panelName: z.string().min(1).max(200),
  priority: z.enum(["routine", "urgent", "stat"]).default("routine"),
  notes: z.string().max(2000).optional(),
});

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
  try {
    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      200,
    );

    const where = {
      ...orgLabWhere(auth.orgId!, auth.activeBranchId, auth.orgHasBranches),
      ...(status && { status }),
      ...(search && {
        panelName: { contains: search, mode: "insensitive" as const },
      }),
    };

    const labs = await prisma.labOrder.findMany({
      where,
      include: labOrderInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return success(labs.map(shapeLabOrderForApi));
  } catch (err) {
    return serverError(err);
  }
  },
  { permission: "lab:read" },
);

export const POST = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
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
      include: labOrderInclude,
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

    return created(shapeLabOrderForApi(order));
  } catch (err) {
    if (err instanceof Error && err.message === "PATIENT_NOT_FOUND") {
      return notFound("Patient");
    }
    return serverError(err);
  }
},
  { permission: "lab:order" },
);
