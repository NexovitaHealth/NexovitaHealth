import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { error, serverError, success } from "@/lib/api-response";
import { acceptInvitationForUser } from "@/lib/invitations";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return error("Sign in to accept this invitation", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, isActive: true, deletedAt: true },
    });
    if (!user?.isActive || user.deletedAt) {
      return error("Account is not active", 403);
    }

    const invitation = await acceptInvitationForUser(
      user.id,
      user.email,
      params.token,
    );

    await createAuditLog({
      orgId: invitation.orgId,
      actorId: user.id,
      action: "invited",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { accepted: true, role: invitation.role },
      req,
    });

    return success({
      orgId: invitation.orgId,
      orgName: invitation.orgName,
      role: invitation.role,
    });
  } catch (err) {
    if (err instanceof Error) {
      const map: Record<string, { msg: string; status: number }> = {
        INVITE_NOT_FOUND: { msg: "Invitation not found", status: 404 },
        INVITE_NOT_PENDING: { msg: "Invitation is no longer valid", status: 410 },
        INVITE_EXPIRED: { msg: "Invitation has expired", status: 410 },
        INVITE_EMAIL_MISMATCH: {
          msg: "Sign in with the email address that received this invitation",
          status: 403,
        },
        ALREADY_MEMBER: {
          msg: "You are already a member of this organization",
          status: 409,
        },
      };
      const mapped = map[err.message];
      if (mapped) return error(mapped.msg, mapped.status);
    }
    return serverError(err);
  }
}
