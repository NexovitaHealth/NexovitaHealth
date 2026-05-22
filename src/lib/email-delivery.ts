import type { EmailDeliveryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const RETRY_MINUTES = [5, 30, 120];

export type TrackedEmailPayload = {
  to: string;
  subject: string;
  html: string;
  template: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
};

export async function createEmailDeliveryLog(payload: TrackedEmailPayload) {
  return prisma.emailDeliveryLog.create({
    data: {
      orgId: payload.orgId,
      to: payload.to,
      subject: payload.subject,
      template: payload.template,
      status: "queued",
      metadata: (payload.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function markEmailSent(
  id: string,
  providerMessageId?: string,
) {
  return prisma.emailDeliveryLog.update({
    where: { id },
    data: {
      status: "sent",
      attempts: { increment: 1 },
      sentAt: new Date(),
      providerMessageId,
      lastError: null,
      nextRetryAt: null,
    },
  });
}

export async function markEmailFailed(id: string, error: string) {
  const log = await prisma.emailDeliveryLog.findUnique({ where: { id } });
  if (!log) return null;

  const attempts = log.attempts + 1;
  const canRetry = attempts < log.maxAttempts;
  const retryDelay =
    RETRY_MINUTES[Math.min(attempts - 1, RETRY_MINUTES.length - 1)] ?? 120;

  return prisma.emailDeliveryLog.update({
    where: { id },
    data: {
      status: canRetry ? "queued" : "failed",
      attempts,
      lastError: error.slice(0, 2000),
      nextRetryAt: canRetry
        ? new Date(Date.now() + retryDelay * 60 * 1000)
        : null,
    },
  });
}

export async function markEmailBounced(
  providerMessageId: string,
  reason?: string,
) {
  const log = await prisma.emailDeliveryLog.findFirst({
    where: { providerMessageId },
    orderBy: { createdAt: "desc" },
  });
  if (!log) return null;

  return prisma.emailDeliveryLog.update({
    where: { id: log.id },
    data: {
      status: "bounced",
      bouncedAt: new Date(),
      lastError: reason?.slice(0, 2000),
      nextRetryAt: null,
    },
  });
}

export async function listEmailDeliveries(
  orgId: string,
  params: {
    status?: EmailDeliveryStatus;
    page?: number;
    pageSize?: number;
  },
) {
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 25, 100);
  const where: Prisma.EmailDeliveryLogWhereInput = { orgId };
  if (params.status) where.status = params.status;

  const [items, total] = await Promise.all([
    prisma.emailDeliveryLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.emailDeliveryLog.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function retryEmailDelivery(deliveryId: string, orgId?: string) {
  const log = await prisma.emailDeliveryLog.findFirst({
    where: {
      id: deliveryId,
      ...(orgId ? { orgId } : {}),
    },
  });
  if (!log) return null;
  if (log.status === "sent") {
    throw new Error("ALREADY_SENT");
  }
  if (log.status === "bounced") {
    throw new Error("BOUNCED");
  }
  if (log.attempts >= log.maxAttempts) {
    throw new Error("MAX_ATTEMPTS");
  }

  return prisma.emailDeliveryLog.update({
    where: { id: log.id },
    data: {
      status: "queued",
      nextRetryAt: new Date(),
      lastError: null,
    },
  });
}

export async function getDeliveriesReadyForRetry(limit = 20) {
  return prisma.emailDeliveryLog.findMany({
    where: {
      status: "queued",
      attempts: { gt: 0 },
      nextRetryAt: { lte: new Date() },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });
}
