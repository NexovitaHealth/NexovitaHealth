import { NextRequest } from "next/server";
import { getSessionFromRequest, clearSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { success, serverError } from "@/lib/api-response";
import { createAuditLog } from "@/lib/audit";
import { AuditAction } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
      await createAuditLog({
        actorId: session.userId,
        action: "logout",
        resourceType: "user",
        resourceId: session.userId,
        req,
      });
    }
    clearSessionCookie();
    return success({ message: "Logged out successfully" });
  } catch (err) {
    return serverError(err);
  }
}
