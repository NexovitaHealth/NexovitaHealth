import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success, error } from '@/lib/api-response'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const invitation = await prisma.agencyInvitation.findUnique({
    where: { token: params.token },
    include: { sender: { select: { fullName: true } } },
  })

  if (!invitation) return error('Invitation not found', 404)
  if (invitation.status !== 'pending') return error('This invitation has already been used or cancelled', 410)
  if (invitation.expiresAt < new Date()) return error('This invitation has expired', 410)

  return success({
    email: invitation.email,
    senderName: invitation.sender.fullName,
    expiresAt: invitation.expiresAt.toISOString(),
  })
}
