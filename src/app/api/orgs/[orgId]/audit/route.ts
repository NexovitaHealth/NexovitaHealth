import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrgAccess } from "@/lib/middleware";
import { paginated, serverError, forbidden } from "@/lib/api-response";
import { OrgRole, UserRole } from "@/types";
import { getPagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req, _ctx, auth) => {
  try {
    const isAdminLevel =
      auth.user.role === "agency_admin" ||
      auth.user.role === "superadmin" ||
      ["agency_admin", "supervisor"].includes(auth.orgRole || "") ||
      ["agency_admin", "supervisor"].includes(auth.orgRole || "");
    if (!isAdminLevel) return forbidden("Audit logs are restricted to admins");

    const { skip, take, page, pageSize } = getPagination(req, 50);
    const resourceType =
      req.nextUrl.searchParams.get("resourceType") || undefined;
    const actorId = req.nextUrl.searchParams.get("actorId") || undefined;

    const where = {
      orgId: auth.orgId!,
      ...(resourceType && { resourceType }),
      ...(actorId && { actorId }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return paginated(logs, total, page, pageSize);
  } catch (err) {
    return serverError(err);
  }
});
