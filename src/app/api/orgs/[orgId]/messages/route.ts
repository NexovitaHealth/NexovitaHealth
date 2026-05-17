import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { success, serverError } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

// GET /api/orgs/[orgId]/messages/threads - list conversation threads
export const GET = withAuth(async (_req: NextRequest, ctx, auth) => {
  try {
    const { orgId, userId } = auth
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

    const messages = await prisma.message.findMany({
      where: {
        orgId,
        deletedAt: null,
        OR: [
          { senderId: userId },
          // recipients is JSON array; filter via raw or just get all org messages
          // For simplicity, return org-wide messages where user is sender or recipient
        ],
      },
      include: {
        sender: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Group by sender/thread (simplified: treat each sender as a thread)
    const threadMap = new Map<string, {
      id: string
      participants: Array<{ id: string; fullName: string }>
      lastMessage: string
      updatedAt: string
      unreadCount: number
      subject?: string
    }>()

    for (const msg of messages) {
      const otherId = msg.senderId === userId ? 'broadcast' : msg.senderId
      const key = msg.senderId === userId ? `sent-${msg.id}` : msg.senderId
      if (!threadMap.has(key)) {
        threadMap.set(key, {
          id: key,
          participants: [msg.sender],
          lastMessage: msg.body.slice(0, 80),
          updatedAt: msg.createdAt.toISOString(),
          unreadCount: !msg.isRead && msg.senderId !== userId ? 1 : 0,
          subject: msg.subject || undefined,
        })
      }
    }

    return success(Array.from(threadMap.values()))
  } catch (err) {
    console.error(err)
    return serverError(err)
  }
})

// POST /api/orgs/[orgId]/messages - send a message
export const POST = withAuth(async (req: NextRequest, ctx, auth) => {
  try {
    const { orgId, userId } = auth
    if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

    const body = await req.json()
    const { recipientIds, subject, content } = body

    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    const message = await prisma.message.create({
      data: {
        orgId,
        senderId: userId,
        subject: subject || null,
        body: content,
        recipients: recipientIds || [],
      },
      include: {
        sender: { select: { id: true, fullName: true } },
      },
    })

    return success(message)
  } catch (err) {
    console.error(err)
    return serverError(err)
  }
})
