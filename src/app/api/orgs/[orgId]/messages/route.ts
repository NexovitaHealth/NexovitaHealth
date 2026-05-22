import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { withOrgAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import {
  created,
  error,
  forbidden,
  success,
  validationError,
  serverError,
} from "@/lib/api-response";
import { auditMessageSent } from "@/lib/audit-events";
import { listOrgMessageThreads } from "@/lib/messages";
import {
  assertRecipientsOnPatientCareTeam,
  isFieldStaffRole,
  userOnPatientCareTeam,
} from "@/lib/message-scope";

export const dynamic = "force-dynamic";

const sendMessageSchema = z.object({
  threadId: z.string().uuid().optional(),
  recipientIds: z.array(z.string().uuid()).optional(),
  patientId: z.string().uuid().optional(),
  subject: z.string().max(200).optional(),
  content: z.string().trim().min(1).max(5000),
});

async function ensureOrgUsers(
  client: typeof prisma | Prisma.TransactionClient,
  orgId: string,
  userIds: string[],
) {
  const uniqueIds = Array.from(new Set(userIds));
  const members = await client.orgMembership.findMany({
    where: { orgId, userId: { in: uniqueIds } },
    select: { userId: true },
  });
  return members.length === uniqueIds.length;
}

export const GET = withOrgAccess(
  async (_req: NextRequest, _ctx, auth) => {
    try {
      const threads = await listOrgMessageThreads(
        auth.orgId!,
        auth.userId,
        auth.user.role,
      );
      return success(threads);
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "message:read" },
);

export const POST = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const body = await req.json();
      const parsed = sendMessageSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const { content, patientId, recipientIds, subject, threadId } =
        parsed.data;
      const fieldStaff = isFieldStaffRole(auth.user.role);

      if (fieldStaff && !threadId) {
        if (!patientId) {
          return error(
            "Field staff must link new messages to an assigned patient",
            400,
          );
        }
        if (!recipientIds?.length) {
          return error("Select at least one care team recipient", 400);
        }
      }

      if (patientId) {
        const patient = await prisma.patient.findFirst({
          where: { id: patientId, orgId: auth.orgId!, deletedAt: null },
          select: { id: true },
        });
        if (!patient) return error("Patient is not available in this org", 400);

        if (fieldStaff) {
          const onTeam = await userOnPatientCareTeam(auth.userId, patientId);
          if (!onTeam) {
            return forbidden(
              "You can only message care teams for your assigned patients",
            );
          }
        }
      }

      if (fieldStaff && patientId && recipientIds?.length) {
        const validRecipients = await assertRecipientsOnPatientCareTeam(
          patientId,
          recipientIds,
        );
        if (!validRecipients) {
          return error(
            "Recipients must be active members of the patient's care team",
            400,
          );
        }
      }

      const message = await prisma.$transaction(async (tx) => {
        let targetThreadId = threadId;
        let recipients: string[] = [];
        let threadCreated = false;

        if (targetThreadId) {
          const thread = await tx.messageThread.findFirst({
            where: {
              id: targetThreadId,
              orgId: auth.orgId!,
              deletedAt: null,
              participants: { some: { userId: auth.userId } },
            },
            include: { participants: { select: { userId: true } } },
          });
          if (!thread) throw new Error("THREAD_NOT_FOUND");

          if (fieldStaff) {
            if (!thread.patientId) throw new Error("THREAD_NOT_FOUND");
            const onTeam = await userOnPatientCareTeam(
              auth.userId,
              thread.patientId,
            );
            if (!onTeam) throw new Error("THREAD_NOT_FOUND");
          }

          recipients = thread.participants
            .map((participant) => participant.userId)
            .filter((userId) => userId !== auth.userId);
        } else {
          if (!recipientIds?.length) throw new Error("RECIPIENTS_REQUIRED");
          const participantIds = Array.from(
            new Set([auth.userId, ...recipientIds]),
          );
          const usersInOrg = await ensureOrgUsers(
            tx,
            auth.orgId!,
            participantIds,
          );
          if (!usersInOrg) throw new Error("INVALID_PARTICIPANTS");

          const thread = await tx.messageThread.create({
            data: {
              orgId: auth.orgId!,
              patientId,
              subject,
              participants: {
                create: participantIds.map((userId) => ({ userId })),
              },
            },
          });
          targetThreadId = thread.id;
          recipients = recipientIds;
          threadCreated = true;
        }

        const createdMessage = await tx.message.create({
          data: {
            orgId: auth.orgId!,
            threadId: targetThreadId,
            senderId: auth.userId,
            subject: subject || null,
            body: content,
            recipients,
          },
          include: {
            sender: { select: { id: true, fullName: true, email: true } },
            thread: { select: { id: true, subject: true, patientId: true } },
          },
        });

        await tx.messageThread.update({
          where: { id: targetThreadId },
          data: { updatedAt: new Date() },
        });

        return { createdMessage, threadCreated, targetThreadId: targetThreadId! };
      });

      await auditMessageSent({
        orgId: auth.orgId!,
        actorId: auth.userId,
        messageId: message.createdMessage.id,
        threadId: message.targetThreadId,
        patientId:
          patientId ?? message.createdMessage.thread?.patientId ?? undefined,
        channel: "staff",
        preview: content,
        threadCreated: message.threadCreated,
        req,
      });

      return created({
        id: message.createdMessage.id,
        threadId: message.createdMessage.threadId,
        content: message.createdMessage.body,
        body: message.createdMessage.body,
        sentAt: message.createdMessage.createdAt,
        createdAt: message.createdMessage.createdAt,
        isRead: message.createdMessage.isRead,
        sender: message.createdMessage.sender,
        thread: message.createdMessage.thread,
      });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "THREAD_NOT_FOUND") {
          return forbidden("You are not a participant in this thread");
        }
        if (err.message === "RECIPIENTS_REQUIRED") {
          return error("recipientIds are required when creating a thread", 400);
        }
        if (err.message === "INVALID_PARTICIPANTS") {
          return error(
            "All message participants must belong to this organization",
            400,
          );
        }
      }
      return serverError(err);
    }
  },
  { permission: "message:send" },
);
