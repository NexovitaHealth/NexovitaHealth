import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const labOrderInclude = {
  patient: { select: { id: true, fullName: true, orgId: true } },
  results: {
    select: {
      id: true,
      componentName: true,
      value: true,
      unit: true,
      referenceMin: true,
      referenceMax: true,
      isAbnormal: true,
      isCritical: true,
    },
  },
} satisfies Prisma.LabOrderInclude;

export function orgLabWhere(orgId: string): Prisma.LabOrderWhereInput {
  return {
    patient: { orgId, deletedAt: null },
  };
}

export async function getOrgLabOrderOrThrow(orgId: string, labOrderId: string) {
  const order = await prisma.labOrder.findFirst({
    where: {
      id: labOrderId,
      ...orgLabWhere(orgId),
    },
  });
  if (!order) throw new Error("LAB_ORDER_NOT_FOUND");
  return order;
}

export function shapeLabOrderForApi(lab: Prisma.LabOrderGetPayload<{
  include: typeof labOrderInclude;
}>) {
  return {
    ...lab,
    testName: lab.panelName,
    orderedAt: lab.createdAt,
    resultDate: lab.resultedAt,
    criticalValues:
      lab.results
        .filter((r) => r.isCritical)
        .map((r) => `${r.componentName}: ${r.value} ${r.unit ?? ""}`)
        .join(", ") || null,
    results: lab.results.map((r) => ({
      component: r.componentName,
      value: r.value,
      unit: r.unit || "",
      referenceRange:
        r.referenceMin && r.referenceMax
          ? `${r.referenceMin} – ${r.referenceMax}`
          : undefined,
      isAbnormal: r.isAbnormal,
    })),
  };
}
