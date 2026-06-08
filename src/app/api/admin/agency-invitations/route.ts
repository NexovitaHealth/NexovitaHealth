import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPlatformOwner } from '@/lib/middleware'
import { success, error, validationError } from '@/lib/api-response'
import { sendAgencySetupEmail } from '@/lib/email'

const Schema = z.object({
  email: z.string().email('Valid email required'),
})

export const POST = withPlatformOwner(async (req: NextRequest, _ctx, auth) => {
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const { email } = parsed.data

  // Cancel any existing pending invite for this email
  await prisma.agencyInvitation.updateMany({
    where: { email: email.toLowerCase(), status: 'pending' },
    data: { status: 'cancelled' },
  })

  const invitation = await prisma.agencyInvitation.create({
    data: {
      email: email.toLowerCase(),
      sentBy: auth.userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const setupUrl = `${APP_URL}/setup-agency?token=${invitation.token}`

  await sendAgencySetupEmail({
    email: invitation.email,
    senderName: auth.user.fullName,
    token: invitation.token,
  })

  return success({ setupUrl, token: invitation.token })
})
