import { createHash } from "node:crypto";
import type { CarePlan, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const carePlanInclude = {
  patient: { select: { id: true, fullName: true } },
  author: { select: { id: true, fullName: true, role: true } },
  signedBy: { select: { id: true, fullName: true, role: true, npiNumber: true } },
  parentCarePlan: { select: { id: true, title: true, version: true } },
  renewals: { select: { id: true, title: true, version: true, status: true } },
  physicianOrders: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.CarePlanInclude;

export const carePlanListInclude = {
  patient: { select: { id: true, fullName: true } },
  author: { select: { id: true, fullName: true } },
  signedBy: { select: { id: true, fullName: true } },
  parentCarePlan: { select: { id: true, title: true, version: true } },
  _count: { select: { renewals: { where: { deletedAt: null } } } },
} satisfies Prisma.CarePlanInclude;

export const carePlanHistoryInclude = {
  author: { select: { id: true, fullName: true, role: true } },
  signedBy: { select: { id: true, fullName: true, npiNumber: true } },
} satisfies Prisma.CarePlanInclude;

export type ListOrgCarePlansOptions = {
  page: number;
  pageSize: number;
  patientId?: string;
  status?: string;
  search?: string;
  unsignedOnly?: boolean;
  branchId?: string;
  orgHasBranches?: boolean;
};

export async function listOrgCarePlans(
  orgId: string,
  options: ListOrgCarePlansOptions,
) {
  const { page, pageSize, patientId, status, search, unsignedOnly, branchId, orgHasBranches } = options;
  const skip = (page - 1) * pageSize;

  const where: Prisma.CarePlanWhereInput = {
    orgId,
    deletedAt: null,
    ...(patientId && { patientId }),
    ...(status && { status: status as CarePlan["status"] }),
    ...(unsignedOnly && { signedAt: null }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        {
          patient: {
            fullName: { contains: search, mode: "insensitive" },
          },
        },
      ],
    }),
    ...(branchId
      ? { patient: { branchId } }
      : orgHasBranches
        ? { patient: { branchId: { not: null } } }
        : {}),
  };

  const [items, total, unsignedCount] = await Promise.all([
    prisma.carePlan.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }],
      include: carePlanListInclude,
    }),
    prisma.carePlan.count({ where }),
    prisma.carePlan.count({
      where: { orgId, deletedAt: null, signedAt: null },
    }),
  ]);

  return { items, total, meta: { unsignedCount } };
}

export async function getCarePlanVersionHistory(
  orgId: string,
  carePlanId: string,
) {
  const anchor = await prisma.carePlan.findFirst({
    where: { id: carePlanId, orgId, deletedAt: null },
    select: { id: true, patientId: true, parentCarePlanId: true },
  });
  if (!anchor) throw new Error("CARE_PLAN_NOT_FOUND");

  let rootId = anchor.id;
  let parentId = anchor.parentCarePlanId;
  while (parentId) {
    const parent = await prisma.carePlan.findFirst({
      where: { id: parentId, orgId, deletedAt: null },
      select: { id: true, parentCarePlanId: true },
    });
    if (!parent) break;
    rootId = parent.id;
    parentId = parent.parentCarePlanId;
  }

  type HistoryRow = Prisma.CarePlanGetPayload<{
    include: typeof carePlanHistoryInclude;
  }>;
  const versions: HistoryRow[] = [];

  let currentId: string | null = rootId;
  while (currentId) {
    const version: HistoryRow | null = await prisma.carePlan.findFirst({
      where: { id: currentId, orgId, deletedAt: null },
      include: carePlanHistoryInclude,
    });
    if (!version) break;
    versions.push(version);

    const child: { id: string } | null = await prisma.carePlan.findFirst({
      where: { parentCarePlanId: currentId, orgId, deletedAt: null },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    currentId = child?.id ?? null;
  }

  const patient = await prisma.patient.findFirst({
    where: { id: anchor.patientId, orgId },
    select: { id: true, fullName: true },
  });

  return {
    anchorId: carePlanId,
    rootId,
    patient,
    versions,
  };
}

export const physicianOrderInclude = {
  patient: { select: { id: true, fullName: true } },
  physician: { select: { id: true, fullName: true, role: true, npiNumber: true } },
  carePlan: { select: { id: true, title: true, version: true, status: true } },
  escalation: { select: { id: true, title: true, severity: true, status: true } },
} satisfies Prisma.PhysicianOrderInclude;

export function assertCarePlanEditor(role: UserRole) {
  if (!["agency_admin", "supervisor", "physician", "physician_independent"].includes(role)) {
    throw new Error("CARE_PLAN_FORBIDDEN");
  }
}

export function assertPhysician(role: UserRole) {
  if (!["physician", "physician_independent"].includes(role)) {
    throw new Error("PHYSICIAN_SIGNATURE_REQUIRED");
  }
}

export function signatureHash(params: {
  resourceId: string;
  signerId: string;
  signedAt: Date;
  meaning: string;
}) {
  return createHash("sha256")
    .update(
      `${params.resourceId}:${params.signerId}:${params.signedAt.toISOString()}:${params.meaning}`,
    )
    .digest("hex");
}

export async function getOrgPatientOrThrow(
  orgId: string,
  patientId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const patient = await client.patient.findFirst({
    where: { id: patientId, orgId, deletedAt: null },
    select: { id: true, orgId: true, fullName: true },
  });
  if (!patient) throw new Error("PATIENT_NOT_FOUND");
  return patient;
}

export async function getOrgCarePlanOrThrow(
  orgId: string,
  carePlanId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const carePlan = await client.carePlan.findFirst({
    where: { id: carePlanId, orgId, deletedAt: null },
    include: carePlanInclude,
  });
  if (!carePlan) throw new Error("CARE_PLAN_NOT_FOUND");
  return carePlan;
}

export async function getOrgPhysicianOrderOrThrow(
  orgId: string,
  orderId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const order = await client.physicianOrder.findFirst({
    where: { id: orderId, orgId, deletedAt: null },
    include: physicianOrderInclude,
  });
  if (!order) throw new Error("PHYSICIAN_ORDER_NOT_FOUND");
  return order;
}

export function ensureCarePlanMutable(carePlan: Pick<CarePlan, "signedAt">) {
  if (carePlan.signedAt) throw new Error("CARE_PLAN_SIGNED");
}

export async function ensureOrgPhysician(
  orgId: string,
  userId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const member = await client.orgMembership.findFirst({
    where: {
      orgId,
      userId,
      user: {
        isActive: true,
        deletedAt: null,
        role: { in: ["physician", "physician_independent"] },
      },
    },
    include: { user: { select: { id: true, role: true } } },
  });
  if (!member) throw new Error("PHYSICIAN_NOT_IN_ORG");
  return member.user;
}

export async function ensureCarePlanBelongsToPatient(
  orgId: string,
  carePlanId: string | undefined,
  patientId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  if (!carePlanId) return null;
  const carePlan = await client.carePlan.findFirst({
    where: { id: carePlanId, orgId, patientId, deletedAt: null },
    select: { id: true },
  });
  if (!carePlan) throw new Error("CARE_PLAN_NOT_FOUND");
  return carePlan;
}

export async function ensureEscalationBelongsToPatient(
  orgId: string,
  escalationId: string | undefined,
  patientId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  if (!escalationId) return null;
  const escalation = await client.escalation.findFirst({
    where: { id: escalationId, orgId, patientId, deletedAt: null },
    select: { id: true },
  });
  if (!escalation) throw new Error("ESCALATION_NOT_FOUND");
  return escalation;
}
