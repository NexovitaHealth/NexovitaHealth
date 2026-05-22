import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPortalAccess } from "@/lib/portal-middleware";
import {
  assertPortalPermission,
  getPatientCareTeamUserIds,
  getPortalActorUserId,
  notifyCareTeamOfPortalMessage,
} from "@/lib/portal";
import {
  created,
  error,
  forbidden,
  serverError,
  validationError,
} from "@/lib/api-response";
import { auditMessageSent } from "@/lib/audit-events";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  threadId: z.string().uuid().optional(),
  subject: z.string().max(200).optional(),
  content: z.string().trim().min(1).max(5000),
});

export const POST = withPortalAccess(async (req: NextRequest, _ctx, portal) => {
  try {
    try {
      assertPortalPermission(portal.permissions, "canMessageCareTeam");
    } catch {
      return error("Messaging is not enabled for this portal session", 403);
    }

    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const userId = getPortalActorUserId(portal);
    const senderName =
      portal.familyCaregiver?.user.fullName || "Family caregiver";
    const { content, threadId, subject } = parsed.data;

    const message = await prisma.$transaction(async (tx) => {
      let targetThreadId = threadId;
      let recipients: string[] = [];
      let threadCreated = false;

      if (targetThreadId) {
        const thread = await tx.messageThread.findFirst({
          where: {
            id: targetThreadId,
            orgId: portal.orgId,
            patientId: portal.patientId,
            deletedAt: null,
            participants: { some: { userId } },
          },
          include: { participants: { select: { userId: true } } },
        });
        if (!thread) throw new Error("THREAD_NOT_FOUND");
        recipients = thread.participants
          .map((p) => p.userId)
          .filter((id) => id !== userId);
      } else {
        const careTeamIds = await getPatientCareTeamUserIds(portal.patientId);
        const participantIds = Array.from(new Set([userId, ...careTeamIds]));
        if (participantIds.length < 2) {
          throw new Error("CARE_TEAM_UNAVAILABLE");
        }

        const thread = await tx.messageThread.create({
          data: {
            orgId: portal.orgId,
            patientId: portal.patientId,
            subject:
              subject ||
              `Care team message · ${portal.patient.fullName}`,
            participants: {
              create: participantIds.map((id) => ({ userId: id })),
            },
          },
        });
        targetThreadId = thread.id;
        recipients = participantIds.filter((id) => id !== userId);
        threadCreated = true;
      }

      const createdMessage = await tx.message.create({
        data: {
          orgId: portal.orgId,
          threadId: targetThreadId,
          senderId: userId,
          body: content,
          recipients,
        },
      });

      await tx.messageThread.update({
        where: { id: targetThreadId },
        data: { updatedAt: new Date() },
      });

      return { createdMessage, targetThreadId, threadCreated };
    });

    await auditMessageSent({
      orgId: portal.orgId,
      actorId: userId,
      messageId: message.createdMessage.id,
      threadId: message.targetThreadId,
      patientId: portal.patientId,
      channel: "portal",
      preview: content,
      threadCreated: message.threadCreated,
      portalSubjectType: portal.subjectType,
      req,
    });

    await notifyCareTeamOfPortalMessage({
      orgId: portal.orgId,
      patientId: portal.patientId,
      patientName: portal.patient.fullName,
      senderUserId: userId,
      senderName,
      preview: content,
      threadId: message.targetThreadId,
    });

    return created({
      id: message.createdMessage.id,
      threadId: message.targetThreadId,
      content: message.createdMessage.body,
      createdAt: message.createdMessage.createdAt,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "THREAD_NOT_FOUND") {
        return forbidden("You are not a participant in this thread");
      }
      if (err.message === "CARE_TEAM_UNAVAILABLE") {
        return error(
          "No active care team members are assigned to this patient yet",
          409,
        );
      }
      if (err.message === "PORTAL_MESSAGING_UNAVAILABLE") {
        return error("Messaging is only available to approved family caregivers", 403);
      }
    }
    return serverError(err);
  }
});
