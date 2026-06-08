import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, error, validationError } from '@/lib/api-response'

const CreateAgencySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().default('us'),
  careSettings: z.array(z.string()).default([]),
  subscriptionTier: z.string().default('agency'),
})

export const GET = withPlatformOwner(async (_req: NextRequest) => {
  const agencies = await prisma.organization.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true, branches: true, patients: true } },
      branches: { where: { isActive: true }, select: { id: true, name: true, city: true, region: true } },
    },
  })
  return success(agencies)
})

export const POST = withPlatformOwner(async (req: NextRequest) => {
  const body = await req.json()
  const parsed = CreateAgencySchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const existing = await prisma.organization.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) return error('An agency with this slug already exists', 409)

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      region: parsed.data.region || null,
      country: parsed.data.country,
      careSettings: parsed.data.careSettings,
      subscriptionTier: parsed.data.subscriptionTier,
      settings: {
        create: {
          onboardingCompleted: false,
          features: {},
        },
      },
    },
    include: { _count: { select: { members: true, branches: true, patients: true } } },
  })

  return success(org, 201)
})
