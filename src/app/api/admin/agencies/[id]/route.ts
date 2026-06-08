import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, error, notFound, validationError } from '@/lib/api-response'

const UpdateAgencySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  careSettings: z.array(z.string()).optional(),
  subscriptionTier: z.string().optional(),
  isActive: z.boolean().optional(),
})

async function getOrg(id: string) {
  return prisma.organization.findFirst({
    where: { id, deletedAt: null },
    include: {
      _count: { select: { members: true, branches: true, patients: true } },
      branches: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, address: true, city: true, region: true, phone: true, isActive: true, createdAt: true },
      },
      members: {
        include: {
          user: { select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, isActive: true, createdAt: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      settings: { select: { primaryCareSetting: true, onboardingCompleted: true, features: true } },
    },
  })
}

export const GET = withPlatformOwner(async (_req: NextRequest, ctx) => {
  const org = await getOrg(ctx.params.id)
  if (!org) return notFound('Agency not found')
  return success(org)
})

export const PATCH = withPlatformOwner(async (req: NextRequest, ctx) => {
  const org = await prisma.organization.findFirst({ where: { id: ctx.params.id, deletedAt: null } })
  if (!org) return notFound('Agency not found')

  const body = await req.json()
  const parsed = UpdateAgencySchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const updated = await prisma.organization.update({
    where: { id: ctx.params.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.email !== undefined && { email: parsed.data.email || null }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
      ...(parsed.data.city !== undefined && { city: parsed.data.city || null }),
      ...(parsed.data.region !== undefined && { region: parsed.data.region || null }),
      ...(parsed.data.country !== undefined && { country: parsed.data.country }),
      ...(parsed.data.careSettings !== undefined && { careSettings: parsed.data.careSettings }),
      ...(parsed.data.subscriptionTier !== undefined && { subscriptionTier: parsed.data.subscriptionTier }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  })
  return success(updated)
})

export const DELETE = withPlatformOwner(async (_req: NextRequest, ctx) => {
  const org = await prisma.organization.findFirst({ where: { id: ctx.params.id, deletedAt: null } })
  if (!org) return notFound('Agency not found')

  await prisma.organization.update({
    where: { id: ctx.params.id },
    data: { deletedAt: new Date(), isActive: false },
  })
  return success({ deleted: true })
})
