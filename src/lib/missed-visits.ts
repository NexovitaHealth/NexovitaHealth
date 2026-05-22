import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

export function getMissedVisitGraceMinutes() {
  const raw = process.env.MISSED_VISIT_GRACE_MINUTES;
  const parsed = raw ? Number.parseInt(raw, 10) : 60;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

export type MissedVisitResult = {
  marked: number;
  visitIds: string[];
};

export async function processMissedVisitsForOrg(
  orgId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<MissedVisitResult> {
  const graceMs = getMissedVisitGraceMinutes() * 60 * 1000;
  const cutoff = new Date(Date.now() - graceMs);

  const overdue = await client.visitLog.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: "scheduled",
      scheduledAt: { lt: cutoff },
    },
    select: {
      id: true,
      patientId: true,
      scheduledAt: true,
      visitType: true,
      patient: { select: { fullName: true } },
      loggedBy: { select: { fullName: true } },
    },
    take: 200,
  });

  if (overdue.length === 0) {
    return { marked: 0, visitIds: [] };
  }

  const visitIds = overdue.map((v) => v.id);

  await client.visitLog.updateMany({
    where: { id: { in: visitIds }, orgId, status: "scheduled" },
    data: { status: "missed" },
  });

  const supervisors = await client.orgMembership.findMany({
    where: {
      orgId,
      user: {
        isActive: true,
        deletedAt: null,
        role: {
          in: ["agency_admin", "supervisor", "billing_manager"],
        },
      },
    },
    select: { userId: true },
  });

  await createNotifications(
    supervisors.flatMap((membership) =>
      overdue.map((visit) => ({
        userId: membership.userId,
        type: "missed_visit",
        title: `Missed visit: ${visit.patient.fullName}`,
        body: `${visit.visitType} scheduled ${visit.scheduledAt.toISOString()} — aide ${visit.loggedBy.fullName}`,
        actionUrl: `/schedule`,
        metadata: {
          orgId,
          patientId: visit.patientId,
          visitId: visit.id,
        },
      })),
    ),
    client,
  );

  return { marked: visitIds.length, visitIds };
}

export async function processMissedVisitsAllOrgs() {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true },
  });

  let totalMarked = 0;
  const byOrg: Record<string, number> = {};

  for (const org of orgs) {
    const result = await processMissedVisitsForOrg(org.id);
    byOrg[org.id] = result.marked;
    totalMarked += result.marked;
  }

  return { totalMarked, byOrg };
}
