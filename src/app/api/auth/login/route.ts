import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import {
  success,
  error,
  validationError,
  serverError,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { AuditAction } from "@/types";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null, isActive: true },
      include: {
        orgMemberships: {
          include: { org: { select: { id: true, name: true, slug: true } } },
          where: { org: { deletedAt: null, isActive: true } },
        },
      },
    });

    if (!user) return error("Invalid email or password", 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return error("Invalid email or password", 401);

    const ipAddress =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const { token, expiresAt } = await createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await createAuditLog({
      actorId: user.id,
      action: "login",
      resourceType: "user",
      resourceId: user.id,
      req,
    });

    setSessionCookie(token, expiresAt);

    return success({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        orgMemberships: user.orgMemberships.map(
          (m: {
            orgId: string;
            role: string;
            isPrimary: boolean;
            org: { id: string; name: string; slug: string };
          }) => ({
            orgId: m.orgId,
            role: m.role,
            isPrimary: m.isPrimary,
            org: m.org,
          }),
        ),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
