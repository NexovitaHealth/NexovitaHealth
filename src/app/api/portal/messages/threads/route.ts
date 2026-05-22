import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import {
  assertPortalPermission,
  getPortalActorUserId,
} from "@/lib/portal";
import { error, serverError, success } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withPortalAccess(async (_req, _ctx, portal) => {
  try {
    try {
      assertPortalPermission(portal.permissions, "canMessageCareTeam");
    } catch {
      return error("Messaging is not enabled for this portal session", 403);
    }

    const userId = getPortalActorUserId(portal);

    const threads = await prisma.messageThread.findMany({
      where: {
        orgId: portal.orgId,
        patientId: portal.patientId,
        deletedAt: null,
        participants: { some: { userId } },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, fullName: true } } },
        },
        participants: {
          include: { user: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return success(
      threads.map((thread) => {
        const last = thread.messages[0];
        return {
          id: thread.id,
          subject: thread.subject,
          lastMessage: last?.body.slice(0, 120) ?? "",
          updatedAt: (last?.createdAt ?? thread.updatedAt).toISOString(),
          participants: thread.participants.map((p) => p.user),
        };
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "PORTAL_MESSAGING_UNAVAILABLE") {
      return error("Messaging is only available to approved family caregivers", 403);
    }
    return serverError(err);
  }
});
