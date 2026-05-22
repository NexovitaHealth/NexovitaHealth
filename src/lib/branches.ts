import { prisma } from "@/lib/prisma";

export async function listOrgBranches(orgId: string) {
  return prisma.orgBranch.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      phone: true,
    },
  });
}

export async function getOrgBranchOrThrow(orgId: string, branchId: string) {
  const branch = await prisma.orgBranch.findFirst({
    where: { id: branchId, orgId, isActive: true },
    select: { id: true, name: true },
  });
  if (!branch) throw new Error("BRANCH_NOT_FOUND");
  return branch;
}
