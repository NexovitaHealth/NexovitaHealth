import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  paginated,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withAuth } from "@/lib/middleware";
import { getPagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const updateNotificationsSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
  isRead: z.boolean().default(true),
});

export const GET = withAuth(async (req: NextRequest, _ctx, auth) => {
  try {
    const { skip, take, page, pageSize } = getPagination(req, 50);
    const isReadParam = req.nextUrl.searchParams.get("isRead");
    const type = req.nextUrl.searchParams.get("type") || undefined;
    const where = {
      userId: auth.userId,
      ...(isReadParam !== null ? { isRead: isReadParam === "true" } : {}),
      ...(type ? { type } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: auth.userId, isRead: false },
      }),
    ]);

    const response = paginated(notifications, total, page, pageSize);
    response.headers.set("X-Notification-Unread-Count", String(unreadCount));
    return response;
  } catch (err) {
    return serverError(err);
  }
});

export const PATCH = withAuth(async (req: NextRequest, _ctx, auth) => {
  try {
    const body = await req.json();
    const parsed = updateNotificationsSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const result = await prisma.notification.updateMany({
      where: {
        userId: auth.userId,
        ...(parsed.data.notificationIds?.length
          ? { id: { in: parsed.data.notificationIds } }
          : {}),
      },
      data: { isRead: parsed.data.isRead },
    });

    return success({ updated: result.count });
  } catch (err) {
    return serverError(err);
  }
});
