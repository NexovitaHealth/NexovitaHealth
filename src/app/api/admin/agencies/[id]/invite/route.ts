import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, error, notFound, validationError } from '@/lib/api-response'
import { sendInvitationEmail } from '@/lib/email'

const InviteSchema = z.object({
  email: z.string().email(),
  orgRole: z.enum(['owner', 'admin', 'member', 'guest']).default('member'),
})

export const POST = withPlatformOwner(async (req: NextRequest, ctx, auth) => {
  const org = await prisma.organization.findFirst({
    where: { id: ctx.params.id, deletedAt: null },
  })
  if (!org) return notFound('Agency not found')

  const body = await req.json()
  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const { email, orgRole } = parsed.data
  const lowerEmail = email.toLowerCase()

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email: lowerEmail } })
  if (existingUser) {
    const existing = await prisma.orgMembership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId: ctx.params.id } },
    })
    if (existing) return error('This user is already a member of the agency', 409)
  }

  // Cancel any pending invites for this email + org
  await prisma.invitation.updateMany({
    where: { orgId: ctx.params.id, email: lowerEmail, status: 'pending' },
    data: { status: 'cancelled' },
  })

  const invitation = await prisma.invitation.create({
    data: {
      orgId: ctx.params.id,
      invitedBy: auth.userId,
      email: lowerEmail,
      role: orgRole,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${invitation.token}`

  await sendInvitationEmail({
    email: lowerEmail,
    inviterName: auth.user.fullName,
    agencyName: org.name,
    role: orgRole,
    token: invitation.token,
    orgId: org.id,
  }).catch((err) => console.error('[AdminInvite] Email send failed:', err))

  return success({ inviteUrl, token: invitation.token }, 201)
})
