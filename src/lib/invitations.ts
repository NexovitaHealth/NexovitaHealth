import { prisma } from "@/lib/prisma";

export async function getInvitationPreview(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      org: { select: { id: true, name: true } },
      inviter: { select: { fullName: true } },
    },
  });

  if (!invitation) return { error: "INVITE_NOT_FOUND" as const };
  if (invitation.status !== "pending") {
    return { error: "INVITE_NOT_PENDING" as const, status: invitation.status };
  }
  if (invitation.expiresAt < new Date()) {
    return { error: "INVITE_EXPIRED" as const };
  }

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      orgId: invitation.orgId,
      orgName: invitation.org.name,
      inviterName: invitation.inviter.fullName,
      expiresAt: invitation.expiresAt.toISOString(),
    },
  };
}

export async function acceptInvitationForUser(userId: string, email: string, token: string) {
  const preview = await getInvitationPreview(token);
  if ("error" in preview && preview.error) {
    throw new Error(preview.error);
  }

  const { invitation } = preview;
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("INVITE_EMAIL_MISMATCH");
  }

  const existing = await prisma.orgMembership.findFirst({
    where: { userId, orgId: invitation.orgId },
  });
  if (existing) throw new Error("ALREADY_MEMBER");

  await prisma.$transaction([
    prisma.orgMembership.create({
      data: {
        userId,
        orgId: invitation.orgId,
        role: invitation.role,
        isPrimary: false,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    }),
  ]);

  return invitation;
}
