import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  success,
  error,
  validationError,
  serverError,
} from "@/lib/api-response";
import type { OrgRole, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  inviteToken: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { email, password, fullName, phone, inviteToken } = parsed.data;

    const invitation = await prisma.invitation.findUnique({
      where: { token: inviteToken, status: "pending" },
      include: { org: true },
    });
    if (!invitation || invitation.expiresAt < new Date()) {
      return error("Invalid or expired invitation", 400);
    }
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return error("This invitation was sent to a different email address", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return error("Email already registered", 409);

    const passwordHash = await hashPassword(password);

    // Infer clinical role from the invitation's org role:
    // owner/admin → agency_admin; member/guest → aide
    const userRole: UserRole = invitation.role === "owner" || invitation.role === "admin"
      ? "agency_admin"
      : "aide";

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        phone,
        role: userRole,
        emailVerified: true,
      },
    });

    await prisma.orgMembership.create({
      data: {
        userId: user.id,
        orgId: invitation.orgId,
        role: invitation.role,
        isPrimary: true,
      },
    });
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });

    // No auto-login — user must sign in manually after registration.
    return success({ message: "Account created. Please sign in." }, 201);
  } catch (err) {
    return serverError(err);
  }
}
