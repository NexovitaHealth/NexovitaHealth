import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const BranchInputSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

export type BranchInput = z.infer<typeof BranchInputSchema>;

export async function listOrgBranches(orgId: string) {
  return prisma.orgBranch.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      region: true,
      phone: true,
    },
  });
}

export async function createBranch(orgId: string, data: BranchInput) {
  return prisma.orgBranch.create({
    data: { orgId, ...data },
    select: { id: true, name: true, address: true, city: true, region: true, phone: true },
  });
}

export async function updateBranch(orgId: string, branchId: string, data: Partial<BranchInput>) {
  const branch = await prisma.orgBranch.findFirst({
    where: { id: branchId, orgId, isActive: true },
  });
  if (!branch) throw new Error("BRANCH_NOT_FOUND");
  return prisma.orgBranch.update({
    where: { id: branchId },
    data,
    select: { id: true, name: true, address: true, city: true, region: true, phone: true },
  });
}

export async function deactivateBranch(orgId: string, branchId: string) {
  const branch = await prisma.orgBranch.findFirst({
    where: { id: branchId, orgId, isActive: true },
  });
  if (!branch) throw new Error("BRANCH_NOT_FOUND");
  await prisma.orgBranch.update({
    where: { id: branchId },
    data: { isActive: false },
  });
}

/**
 * Returns a Prisma WHERE fragment that scopes records by location.
 * - Specific branch selected → exact match
 * - All Locations + org has branches → exclude unassigned (branchId IS NOT NULL)
 * - No branches configured → no filter
 */
export function branchFilter(
  activeBranchId?: string,
  orgHasBranches?: boolean,
): { branchId?: string | { not: null } } {
  if (activeBranchId) return { branchId: activeBranchId };
  if (orgHasBranches) return { branchId: { not: null } };
  return {};
}

export function patientBranchFilter(
  activeBranchId?: string,
  orgHasBranches?: boolean,
): { patient?: { branchId: string | { not: null } } } {
  if (activeBranchId) return { patient: { branchId: activeBranchId } };
  if (orgHasBranches) return { patient: { branchId: { not: null } } };
  return {};
}

export async function getOrgBranchOrThrow(orgId: string, branchId: string) {
  const branch = await prisma.orgBranch.findFirst({
    where: { id: branchId, orgId, isActive: true },
    select: { id: true, name: true },
  });
  if (!branch) throw new Error("BRANCH_NOT_FOUND");
  return branch;
}
