import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import {
  success,
  forbidden,
  validationError,
  serverError,
  error,
} from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member", "guest"]).default("member"),
});

export const POST = withOrgAccess(async (req, _ctx, auth) => {
  try {
    if (!["owner", "admin"].includes(auth.orgRole || "")) {
      return forbidden("Only admins and owners can invite members");
    }

    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { email, role } = parsed.data;

    // Check if already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: (email as string).toLowerCase() },
    });
    if (existingUser) {
      const existing = await prisma.orgMembership.findFirst({
        where: { userId: existingUser.id, orgId: auth.orgId! },
      });
      if (existing)
        return error("User is already a member of this organization", 409);
    }

    // Cancel any pending invites for same email
    await prisma.invitation.updateMany({
      where: {
        orgId: auth.orgId!,
        email: (email as string).toLowerCase(),
        status: "pending",
      },
      data: { status: "cancelled" },
    });

    const invitation = await prisma.invitation.create({
      data: {
        orgId: auth.orgId!,
        invitedBy: auth.userId,
        email: (email as string).toLowerCase(),
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: {
        org: { select: { id: true, name: true } },
        inviter: { select: { id: true, fullName: true } },
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "invited",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { invitedEmail: email, role },
      req,
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register?inviteToken=${invitation.token}`;

    await sendInvitationEmail({
      email: invitation.email,
      inviterName: invitation.inviter.fullName,
      agencyName: invitation.org.name,
      role,
      token: invitation.token,
    }).catch((err) => {
      console.error("[Invite] Failed to send invitation email", err);
    });

    if (existingUser) {
      await createNotification({
        userId: existingUser.id,
        type: "invite",
        title: `Invitation to join ${invitation.org.name}`,
        body: `${invitation.inviter.fullName} invited you to join ${invitation.org.name}.`,
        actionUrl: inviteUrl,
        metadata: {
          orgId: invitation.orgId,
          invitationId: invitation.id,
          role,
        },
      });
    }

    return success({
      invitation,
      inviteUrl,
    });
  } catch (err) {
    return serverError(err);
  }
});

export const GET = withOrgAccess(async (_req, _ctx, auth) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { orgId: auth.orgId!, status: "pending" },
      include: { inviter: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return success(invitations);
  } catch (err) {
    return serverError(err);
  }
});
