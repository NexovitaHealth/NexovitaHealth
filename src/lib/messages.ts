import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getFieldStaffPatientIds,
  isFieldStaffRole,
  threadVisibleToFieldStaff,
} from "@/lib/message-scope";

const threadInclude = {
  patient: { select: { id: true, fullName: true } },
  participants: {
    include: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { sender: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.MessageThreadInclude;

export type SerializedMessageThread = {
  id: string;
  subject: string | null;
  patient: { id: string; fullName: string } | null;
  participants: Array<{ id: string; fullName: string; email: string }>;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
};

export async function listOrgMessageThreads(
  orgId: string,
  userId: string,
  userRole: string,
): Promise<SerializedMessageThread[]> {
  const threads = await prisma.messageThread.findMany({
    where: {
      orgId,
      deletedAt: null,
      participants: { some: { userId } },
    },
    include: threadInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  let visibleThreads = threads;
  if (isFieldStaffRole(userRole)) {
    const patientIds = await getFieldStaffPatientIds(userId, orgId);
    const accessible = new Set(patientIds);
    visibleThreads = threads.filter((thread) =>
      threadVisibleToFieldStaff(thread, accessible),
    );
  }

  const unreadCounts = await Promise.all(
    visibleThreads.map((thread) => {
      const participant = thread.participants.find((p) => p.userId === userId);
      return prisma.message.count({
        where: {
          threadId: thread.id,
          senderId: { not: userId },
          ...(participant?.lastReadAt
            ? { createdAt: { gt: participant.lastReadAt } }
            : {}),
        },
      });
    }),
  );

  return visibleThreads.map((thread, index) => {
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
  });
}

export async function assertThreadReadable(
  threadId: string,
  orgId: string,
  userId: string,
  userRole: string,
) {
  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, orgId, deletedAt: null },
    select: {
      id: true,
      patientId: true,
      participants: { select: { userId: true } },
    },
  });

  if (!thread) return { ok: false as const, reason: "not_found" as const };
  if (!thread.participants.some((p) => p.userId === userId)) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  if (isFieldStaffRole(userRole)) {
    if (!thread.patientId) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    const patientIds = await getFieldStaffPatientIds(userId, orgId);
    if (!patientIds.includes(thread.patientId)) {
      return { ok: false as const, reason: "forbidden" as const };
    }
  }

  return { ok: true as const, thread };
}
