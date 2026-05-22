import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import {
  assertPortalPermission,
  getPortalActorUserId,
} from "@/lib/portal";
import {
  error,
  forbidden,
  notFound,
  serverError,
  success,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(
  async (_req: NextRequest, ctx, portal) => {
    try {
      try {
        assertPortalPermission(portal.permissions, "canMessageCareTeam");
      } catch {
        return error("Messaging is not enabled for this portal session", 403);
      }

      const userId = getPortalActorUserId(portal);

      const thread = await prisma.messageThread.findFirst({
        where: {
          id: ctx.params.threadId,
          orgId: portal.orgId,
          patientId: portal.patientId,
          deletedAt: null,
        },
        include: {
          participants: { select: { userId: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { sender: { select: { id: true, fullName: true } } },
          },
        },
      });

      if (!thread) return notFound("Message thread");
      if (!thread.participants.some((p) => p.userId === userId)) {
        return forbidden("You are not a participant in this thread");
      }

      await prisma.messageThreadParticipant.update({
        where: { threadId_userId: { threadId: thread.id, userId } },
        data: { lastReadAt: new Date() },
      });

      return success(
        thread.messages.map((message) => ({
          id: message.id,
          content: message.body,
          createdAt: message.createdAt,
          sender: message.sender,
        })),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "PORTAL_MESSAGING_UNAVAILABLE") {
        return error("Messaging is only available to approved family caregivers", 403);
      }
      return serverError(err);
    }
  },
);
