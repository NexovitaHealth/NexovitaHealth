import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success } from '@/lib/api-response'

export const GET = withPlatformOwner(async (_req: NextRequest) => {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    totalAgencies,
    activeAgencies,
    newAgenciesThisMonth,
    totalStaff,
    totalPatients,
    totalBranches,
    pendingInvitations,
    recentAgencies,
  ] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.organization.count({ where: { deletedAt: null, isActive: true } }),
    prisma.organization.count({ where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { deletedAt: null, role: { not: 'owner' } } }),
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.orgBranch.count({ where: { isActive: true } }),
    prisma.invitation.count({ where: { status: 'pending', expiresAt: { gte: new Date() } } }),
    prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        region: true,
        isActive: true,
        createdAt: true,
        _count: { select: { members: true, branches: true, patients: true } },
      },
    }),
  ])

  return success({
    totalAgencies,
    activeAgencies,
    newAgenciesThisMonth,
    totalStaff,
    totalPatients,
    totalBranches,
    pendingInvitations,
    recentAgencies,
  })
})
