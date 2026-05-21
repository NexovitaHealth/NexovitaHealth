import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendCriticalAlertEmail } from "@/lib/email";

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
};

export async function createNotification(
  input: NotificationInput,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function createNotifications(
  notifications: NotificationInput[],
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  if (notifications.length === 0) return { count: 0 };

  return client.notification.createMany({
    data: notifications.map((notification) => ({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      metadata: (notification.metadata ?? {}) as Prisma.InputJsonValue,
    })),
  });
}

export async function getOrgNotificationRecipients(orgId: string) {
  const memberships = await prisma.orgMembership.findMany({
    where: {
      orgId,
      user: {
        isActive: true,
        deletedAt: null,
        role: {
          in: ["agency_admin", "supervisor", "physician", "physician_independent"],
        },
      },
    },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  return memberships.map((membership) => membership.user);
}

export async function notifyCriticalClinicalAlert(params: {
  orgId: string;
  patientId: string;
  patientName: string;
  alertId: string;
  title: string;
  body: string;
  vitalId?: string;
}) {
  const recipients = await getOrgNotificationRecipients(params.orgId);
  const actionUrl = `/patients/${params.patientId}`;

  await createNotifications(
    recipients.map((recipient) => ({
      userId: recipient.id,
      type: "critical_alert",
      title: params.title,
      body: `${params.patientName}: ${params.body}`,
      actionUrl,
      metadata: {
        orgId: params.orgId,
        patientId: params.patientId,
        alertId: params.alertId,
        vitalId: params.vitalId,
        severity: "critical",
      },
    })),
  );

  await Promise.allSettled(
    recipients.map((recipient) =>
      sendCriticalAlertEmail({
        email: recipient.email,
        recipientName: recipient.fullName,
        patientName: params.patientName,
        alertTitle: params.title,
        alertBody: params.body,
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${actionUrl}`,
      }),
    ),
  );

  return { recipientsNotified: recipients.length };
}
