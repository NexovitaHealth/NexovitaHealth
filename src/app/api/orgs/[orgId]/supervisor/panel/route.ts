import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, serverError, success } from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { syncExpiredAuthorisations } from "@/lib/payer-authorisations";

export const dynamic = "force-dynamic";

const SUPERVISOR_ROLES = [
  "agency_admin",
  "supervisor",
  "physician",
  "physician_independent",
];

export const GET = withOrgAccess(async (_req: NextRequest, _ctx, auth) => {
  try {
    if (!SUPERVISOR_ROLES.includes(auth.user.role)) {
      return error("Supervisor panel is for clinical leadership roles", 403);
    }

    await syncExpiredAuthorisations(auth.orgId!);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      expiringAuthorisations,
      openEscalations,
      openIncidents,
      pendingReviews,
      recentEscalations,
      recentIncidents,
    ] = await Promise.all([
      prisma.payerAuthorisation.findMany({
        where: {
          orgId: auth.orgId!,
          deletedAt: null,
          status: "active",
          endDate: { lte: in30Days, gte: now },
        },
        orderBy: { endDate: "asc" },
        take: 10,
        include: { patient: { select: { id: true, fullName: true } } },
      }),
      prisma.escalation.count({
        where: {
          orgId: auth.orgId!,
          deletedAt: null,
          status: { in: ["open", "in_review"] },
        },
      }),
      prisma.incident.count({
        where: {
          orgId: auth.orgId!,
          deletedAt: null,
          status: { in: ["reported", "triaged"] },
        },
      }),
      prisma.visitReview.count({
        where: { orgId: auth.orgId!, status: "pending" },
      }),
      prisma.escalation.findMany({
        where: {
          orgId: auth.orgId!,
          deletedAt: null,
          status: { in: ["open", "in_review"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { patient: { select: { id: true, fullName: true } } },
      }),
      prisma.incident.findMany({
        where: {
          orgId: auth.orgId!,
          deletedAt: null,
          status: { in: ["reported", "triaged"] },
        },
        orderBy: { occurredAt: "desc" },
        take: 5,
        include: { patient: { select: { id: true, fullName: true } } },
      }),
    ]);

    return success({
      counts: {
        expiringAuthorisations: expiringAuthorisations.length,
        openEscalations,
        openIncidents,
        pendingVisitReviews: pendingReviews,
      },
      expiringAuthorisations,
      recentEscalations,
      recentIncidents,
    });
  } catch (err) {
    return serverError(err);
  }
});
