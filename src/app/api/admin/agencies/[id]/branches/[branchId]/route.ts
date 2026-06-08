import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, notFound, validationError } from '@/lib/api-response'

const UpdateBranchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const PATCH = withPlatformOwner(async (req: NextRequest, ctx) => {
  const branch = await prisma.orgBranch.findFirst({
    where: { id: ctx.params.branchId, orgId: ctx.params.id },
  })
  if (!branch) return notFound('Branch not found')

  const body = await req.json()
  const parsed = UpdateBranchSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const updated = await prisma.orgBranch.update({
    where: { id: ctx.params.branchId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
      ...(parsed.data.city !== undefined && { city: parsed.data.city || null }),
      ...(parsed.data.region !== undefined && { region: parsed.data.region || null }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  })
  return success(updated)
})

export const DELETE = withPlatformOwner(async (_req: NextRequest, ctx) => {
  const branch = await prisma.orgBranch.findFirst({
    where: { id: ctx.params.branchId, orgId: ctx.params.id },
  })
  if (!branch) return notFound('Branch not found')

  await prisma.orgBranch.update({
    where: { id: ctx.params.branchId },
    data: { isActive: false },
  })
  return success({ deactivated: true })
})
