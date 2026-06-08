import { NextRequest } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, error, notFound, validationError } from '@/lib/api-response'

const AddMemberSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  password: z.string().min(8),
  userRole: z.enum([
    'agency_admin', 'supervisor', 'physician', 'physician_independent',
    'aide', 'billing_manager', 'school_nurse',
  ]),
  orgRole: z.enum(['owner', 'admin', 'member', 'guest']).default('member'),
})

export const GET = withPlatformOwner(async (_req: NextRequest, ctx) => {
  const org = await prisma.organization.findFirst({ where: { id: ctx.params.id, deletedAt: null } })
  if (!org) return notFound('Agency not found')

  const members = await prisma.orgMembership.findMany({
    where: { orgId: ctx.params.id },
    include: {
      user: {
        select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, isActive: true, createdAt: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })
  return success(members)
})

export const POST = withPlatformOwner(async (req: NextRequest, ctx) => {
  const org = await prisma.organization.findFirst({ where: { id: ctx.params.id, deletedAt: null } })
  if (!org) return notFound('Agency not found')

  const body = await req.json()
  const parsed = AddMemberSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const { email, fullName, password, userRole, orgRole } = parsed.data
  const lowerEmail = email.toLowerCase()

  let user = await prisma.user.findUnique({ where: { email: lowerEmail } })

  if (user) {
    const existing = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: ctx.params.id } },
    })
    if (existing) return error('User is already a member of this agency', 409)
    // Update their role if they exist
    await prisma.user.update({ where: { id: user.id }, data: { role: userRole } })
  } else {
    const passwordHash = await bcrypt.hash(password, 12)
    user = await prisma.user.create({
      data: {
        email: lowerEmail,
        passwordHash,
        fullName,
        role: userRole,
        emailVerified: true,
      },
    })
  }

  const hasPrimary = await prisma.orgMembership.findFirst({ where: { userId: user.id, isPrimary: true } })

  const membership = await prisma.orgMembership.create({
    data: {
      userId: user.id,
      orgId: ctx.params.id,
      role: orgRole,
      isPrimary: !hasPrimary,
    },
    include: {
      user: {
        select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, isActive: true },
      },
    },
  })

  return success(membership, 201)
})
