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
            role: true,
            avatarUrl: true,
            phone: true,
            isActive: true,
            lastLoginAt: true,
            licenseNumber: true,
            licenseType: true,
            specializations: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return success(
      members.map(
        (m: {
          userId: string;
          role: string;
          isPrimary: boolean;
          joinedAt: Date;
          user: {
            id: string;
            fullName: string;
            email: string;
            avatarUrl: string | null;
          };
        }) => ({
          userId: m.userId,
          orgRole: m.role,
          isPrimary: m.isPrimary,
          joinedAt: m.joinedAt,
          ...m.user,
        }),
      ),
    );
  } catch (err) {
    return serverError(err);
  }
});

export const DELETE = withOrgAccess(async (req, _ctx, auth) => {
  try {
    // Only owners and admins can remove members
    if (!["owner", "admin"].includes(auth.orgRole || "")) {
      return forbidden();
    }

    const { userId } = await req.json();
    if (userId === auth.userId) return forbidden("Cannot remove yourself");

    // Owners can only be removed by other owners
    const targetMembership = await prisma.orgMembership.findFirst({
      where: { orgId: auth.orgId!, userId },
    });
    if (!targetMembership) return success({ removed: false });
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
