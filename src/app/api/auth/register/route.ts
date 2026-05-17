import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import {
  success,
  error,
  validationError,
  serverError,
} from "@/lib/api-response";
import { OrgRole, UserRole } from "@/types";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  // Optional: accept invite token to join existing org
  inviteToken: z.string().uuid().optional(),
  // Optional: create a new org
  orgName: z.string().min(2).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { email, password, fullName, phone, inviteToken, orgName } =
      parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) return error("Email already registered", 409);

    const passwordHash = await hashPassword(password);

    // Check invite
    let invitation = null;
    if (inviteToken) {
      invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken, status: "pending" },
        include: { org: true },
      });
      if (!invitation || invitation.expiresAt < new Date()) {
        return error("Invalid or expired invitation", 400);
      }
      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return error(
          "This invitation was sent to a different email address",
          400,
        );
      }
    }

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        phone,
        role: invitation ? "aide" : "agency_admin",
        emailVerified: false,
      },
    });

    // Accept invite or create new org
    if (invitation) {
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
    } else if (orgName) {
      const slug =
        orgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Date.now();
      const org = await prisma.organization.create({
        data: {
          name: orgName,
          slug,
          settings: {
            create: { onboardingCompleted: false, features: {} },
          },
        },
      });
      await prisma.orgMembership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: "owner",
          isPrimary: true,
        },
      });
    }

    const ipAddress = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;
    const { token, expiresAt } = await createSession(
      user.id,
      ipAddress,
      userAgent,
    );
    setSessionCookie(token, expiresAt);

    return success(
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      },
      201,
    );
  } catch (err) {
    return serverError(err);
  }
}
