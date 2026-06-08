import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { success, error, validationError, serverError } from '@/lib/api-response'
import { createAuditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const Schema = z.object({
  token: z.string().uuid('Invalid invitation token'),
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  agencyName: z.string().min(2, 'Agency name is required'),
  city: z.string().optional(),
  region: z.string().optional(),
})

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { token, fullName, email, password, agencyName, city, region } = parsed.data

    const invitation = await prisma.agencyInvitation.findUnique({
      where: { token },
    })
    if (!invitation || invitation.status !== 'pending') {
      return error('Invalid or already-used invitation', 400)
    }
    if (invitation.expiresAt < new Date()) {
      return error('This invitation has expired', 400)
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return error('This invitation was sent to a different email address', 400)
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) return error('An account with this email already exists', 409)

    // Ensure slug is unique
    let slug = slugify(agencyName)
    const slugConflict = await prisma.organization.findUnique({ where: { slug } })
    if (slugConflict) slug = `${slug}-${Date.now().toString(36)}`

    const passwordHash = await hashPassword(password)

    const { user, org } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          fullName,
          role: 'agency_admin',
          emailVerified: true,
        },
      })

      const org = await tx.organization.create({
        data: {
          name: agencyName,
          slug,
          city: city || null,
          region: region || null,
          isActive: true,
        },
      })

      await tx.orgSettings.create({
        data: { orgId: org.id },
      })

      await tx.orgMembership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: 'owner',
          isPrimary: true,
        },
      })

      await tx.agencyInvitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date(), orgId: org.id },
      })

      return { user, org }
    })

    await createAuditLog({
      actorId: user.id,
      action: 'created',
      resourceType: 'Organization',
      resourceId: org.id,
      orgId: org.id,
      metadata: { source: 'agency_invitation', agencyName },
    })

    return success({ message: 'Agency created. Please sign in to get started.' }, 201)
  } catch (err) {
    return serverError(err)
  }
}
