import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { assertThreadReadable } from "@/lib/messages";
import {
  forbidden,
  notFound,
  serverError,
  success,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (_req: NextRequest, ctx, auth) => {
    try {
      const access = await assertThreadReadable(
        ctx.params.threadId,
        auth.orgId!,
        auth.userId,
        auth.user.role,
      );
      if (!access.ok) {
        if (access.reason === "not_found") {
          return notFound("Message thread");
        }
        return forbidden("You are not a participant in this thread");
      }

      const thread = await prisma.messageThread.findFirst({
        where: {
          id: ctx.params.threadId,
          orgId: auth.orgId!,
          deletedAt: null,
        },
        include: {
          patient: { select: { id: true, fullName: true } },
          participants: {
            include: {
              user: { select: { id: true, fullName: true, email: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: { select: { id: true, fullName: true, email: true } },
            },
          },
        },
      });

      if (!thread) return notFound("Message thread");

      await prisma.messageThreadParticipant.update({
        where: {
          threadId_userId: {
            threadId: thread.id,
            userId: auth.userId,
          },
        },
        data: { lastReadAt: new Date() },
      });

      return success(
        thread.messages.map((message) => ({
          id: message.id,
          threadId: message.threadId,
          content: message.body,
          body: message.body,
          sentAt: message.createdAt,
          createdAt: message.createdAt,
          isRead: message.isRead,
          sender: message.sender,
        })),
      );
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "message:read" },
);
