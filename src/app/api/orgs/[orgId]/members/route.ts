import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import { success, serverError, forbidden } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (_req, _ctx, auth) => {
  try {
    const members = await prisma.orgMembership.findMany({
      where: { orgId: auth.orgId! },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true, // UserRole
            avatarUrl: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    // Explicitly expose orgRole (the OrgMembership.role) alongside the user's UserRole
    return success(
      members.map((m) => ({
        userId: m.userId,
        orgRole: m.role, // OrgRole: owner|admin|member|guest
        isPrimary: m.isPrimary,
        joinedAt: m.joinedAt,
        // Spread user fields (includes user.role = UserRole)
        ...m.user,
      })),
    );
  } catch (err) {
    return serverError(err);
  }
});

export const DELETE = withOrgAccess(async (req, _ctx, auth) => {
  try {
    if (!["owner", "admin"].includes(auth.orgRole || "")) {
      return forbidden();
    }

    // Fix: read userId from JSON body (not query param)
    const { userId } = await req.json();
    if (!userId) return forbidden("userId is required");
    if (userId === auth.userId) return forbidden("Cannot remove yourself");

    const targetMembership = await prisma.orgMembership.findFirst({
      where: { orgId: auth.orgId!, userId },
    });
    if (!targetMembership) return success({ removed: false });

    // Only owners can remove other owners
    if (targetMembership.role === "owner" && auth.orgRole !== "owner") {
      return forbidden("Only owners can remove other owners");
    }

    await prisma.orgMembership.delete({
      where: { userId_orgId: { userId, orgId: auth.orgId! } },
    });

    return success({ removed: true });
  } catch (err) {
    return serverError(err);
  }
});
