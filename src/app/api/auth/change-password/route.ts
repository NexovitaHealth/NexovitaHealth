import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, getSessionFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return error("Not authenticated", 401);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) return error("User not found", 404);

    const valid = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!valid) return error("Current password is incorrect", 400);

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await createAuditLog({
      actorId: user.id,
      action: "updated",
      resourceType: "user",
      resourceId: user.id,
      metadata: { field: "password" },
      req,
    });

    return success({ changed: true });
  } catch (err) {
    return serverError(err);
  }
}
