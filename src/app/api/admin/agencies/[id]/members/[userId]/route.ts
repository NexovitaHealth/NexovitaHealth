import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, notFound, validationError } from '@/lib/api-response'

const UpdateMemberSchema = z.object({
  orgRole: z.enum(['owner', 'admin', 'member', 'guest']).optional(),
  userRole: z.enum([
    'agency_admin', 'supervisor', 'physician', 'physician_independent',
    'aide', 'billing_manager', 'school_nurse',
  ]).optional(),
})

export const PATCH = withPlatformOwner(async (req: NextRequest, ctx) => {
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: ctx.params.userId, orgId: ctx.params.id } },
  })
  if (!membership) return notFound('Member not found')

  const body = await req.json()
  const parsed = UpdateMemberSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  if (parsed.data.orgRole) {
    await prisma.orgMembership.update({
      where: { userId_orgId: { userId: ctx.params.userId, orgId: ctx.params.id } },
      data: { role: parsed.data.orgRole },
    })
  }

  if (parsed.data.userRole) {
    await prisma.user.update({
      where: { id: ctx.params.userId },
      data: { role: parsed.data.userRole },
    })
  }

  const updated = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: ctx.params.userId, orgId: ctx.params.id } },
    include: {
      user: { select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, isActive: true } },
    },
  })
  return success(updated)
})

export const DELETE = withPlatformOwner(async (_req: NextRequest, ctx) => {
  const membership = await prisma.orgMembership.findUnique({
    where: { userId_orgId: { userId: ctx.params.userId, orgId: ctx.params.id } },
  })
  if (!membership) return notFound('Member not found')

  await prisma.orgMembership.delete({
    where: { userId_orgId: { userId: ctx.params.userId, orgId: ctx.params.id } },
  })
  return success({ removed: true })
})
