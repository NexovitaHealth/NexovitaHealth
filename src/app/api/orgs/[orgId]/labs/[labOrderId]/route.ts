import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { getOrgLabOrderOrThrow, labOrderInclude } from "@/lib/labs";

export const dynamic = "force-dynamic";

const resultComponentSchema = z.object({
  componentName: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  referenceMin: z.string().max(50).optional(),
  referenceMax: z.string().max(50).optional(),
  isAbnormal: z.boolean().optional(),
  isCritical: z.boolean().optional(),
});

const addResultsSchema = z.object({
  status: z.enum(["collected", "resulted", "cancelled"]).optional(),
  results: z.array(resultComponentSchema).min(1),
  notes: z.string().max(2000).optional(),
});

export const PATCH = withOrgAccess(
  async (req: NextRequest, ctx, auth) => {
  try {
    const order = await getOrgLabOrderOrThrow(
      auth.orgId!,
      ctx.params.labOrderId,
    );

    const body = await req.json();
    const parsed = addResultsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.labResult.deleteMany({ where: { labOrderId: order.id } });
      await tx.labResult.createMany({
        data: parsed.data.results.map((r) => ({
          labOrderId: order.id,
          componentName: r.componentName,
          value: r.value,
          unit: r.unit,
          referenceMin: r.referenceMin,
          referenceMax: r.referenceMax,
          isAbnormal: r.isAbnormal ?? false,
          isCritical: r.isCritical ?? false,
        })),
      });

      const hasCritical = parsed.data.results.some((r) => r.isCritical);
      return tx.labOrder.update({
        where: { id: order.id },
        data: {
          status: parsed.data.status ?? (hasCritical ? "critical" : "resulted"),
          notes: parsed.data.notes ?? order.notes,
          resultedAt: new Date(),
        },
        include: labOrderInclude,
      });
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "updated",
      resourceType: "lab_order",
      resourceId: order.id,
      patientId: order.patientId,
      metadata: {
        status: updated.status,
        resultCount: parsed.data.results.length,
      },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "LAB_ORDER_NOT_FOUND") {
      return notFound("Lab order");
    }
    return serverError(err);
  }
},
  { permission: "lab:result" },
);
