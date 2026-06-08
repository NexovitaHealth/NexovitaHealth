import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, notFound, validationError } from '@/lib/api-response'

const CreateBranchSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  phone: z.string().optional(),
})

export const GET = withPlatformOwner(async (_req: NextRequest, ctx) => {
  const org = await prisma.organization.findFirst({ where: { id: ctx.params.id, deletedAt: null } })
  if (!org) return notFound('Agency not found')

  const branches = await prisma.orgBranch.findMany({
    where: { orgId: ctx.params.id },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { patients: true } } },
  })
  return success(branches)
})

export const POST = withPlatformOwner(async (req: NextRequest, ctx) => {
  const org = await prisma.organization.findFirst({ where: { id: ctx.params.id, deletedAt: null } })
  if (!org) return notFound('Agency not found')

  const body = await req.json()
  const parsed = CreateBranchSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const branch = await prisma.orgBranch.create({
    data: {
      orgId: ctx.params.id,
      name: parsed.data.name,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      region: parsed.data.region || null,
      phone: parsed.data.phone || null,
    },
  })
  return success(branch, 201)
})
