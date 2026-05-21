import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withAuth } from "@/lib/middleware";

export const dynamic = "force-dynamic";

const updateNotificationSchema = z.object({
  isRead: z.boolean(),
});

export const PATCH = withAuth(async (req: NextRequest, ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = updateNotificationSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const notification = await prisma.notification.findFirst({
      where: {
        id: ctx.params.notificationId,
        userId: auth.userId,
      },
    });
    if (!notification) return notFound("Notification");

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: parsed.data.isRead },
    });

    return success(updated);
  } catch (err) {
    return serverError(err);
  }
});
