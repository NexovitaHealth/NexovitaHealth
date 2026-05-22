import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { success, serverError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, _ctx, auth) => {
  try {
    const threads = await prisma.messageThread.findMany({
      where: {
        orgId: auth.orgId!,
        deletedAt: null,
        participants: { some: { userId: auth.userId } },
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        participants: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const unreadCounts = await Promise.all(
      threads.map((thread) => {
        const participant = thread.participants.find(
          (p) => p.userId === auth.userId,
        );
        return prisma.message.count({
          where: {
            threadId: thread.id,
            senderId: { not: auth.userId },
            ...(participant?.lastReadAt
              ? { createdAt: { gt: participant.lastReadAt } }
              : {}),
          },
        });
      }),
    );

    return success(
      threads.map((thread, index) => {
        const lastMessage = thread.messages[0];
        return {
          id: thread.id,
          subject: thread.subject,
          patient: thread.patient,
          participants: thread.participants.map((p) => p.user),
          lastMessage: lastMessage?.body.slice(0, 120) ?? "",
          updatedAt:
            lastMessage?.createdAt.toISOString() ?? thread.updatedAt.toISOString(),
          unreadCount: unreadCounts[index],
        };
      }),
    );
  } catch (err) {
    return serverError(err);
  }
  },
  { permission: "message:read" },
);
