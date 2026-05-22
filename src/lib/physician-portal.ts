import { prisma } from "@/lib/prisma";
import { physicianOrderInclude } from "@/lib/care-plans";

const OPEN_ESCALATION_STATUSES = ["open", "in_review"] as const;

export async function getPhysicianAssignedPatientIds(
  orgId: string,
  physicianId: string,
) {
  const rows = await prisma.patientCareTeam.findMany({
    where: {
      userId: physicianId,
      isActive: true,
      patient: { orgId, deletedAt: null, isDraft: false },
    },
    select: { patientId: true },
  });
  return rows.map((r) => r.patientId);
}

export async function getPhysicianPortalSummary(
  orgId: string,
  physicianId: string,
) {
  const patientIds = await getPhysicianAssignedPatientIds(orgId, physicianId);
  const scopedPatients = { patientId: { in: patientIds } };

  const [
    assignedPatients,
    counts,
    recentDraftOrders,
    recentEscalations,
    carePlansPendingSign,
  ] = await Promise.all([
    patientIds.length > 0
      ? prisma.patient.findMany({
          where: { id: { in: patientIds }, orgId, deletedAt: null },
          orderBy: [{ riskLevel: "desc" }, { fullName: "asc" }],
          take: 12,
          select: {
            id: true,
            fullName: true,
            riskLevel: true,
            status: true,
            primaryDiagnosis: true,
            _count: {
              select: {
                alerts: { where: { isResolved: false } },
                escalations: {
                  where: { status: { in: [...OPEN_ESCALATION_STATUSES] } },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    Promise.all([
      Promise.resolve(patientIds.length),
      prisma.physicianOrder.count({
        where: {
          orgId,
          physicianId,
          deletedAt: null,
          status: "draft",
        },
      }),
      patientIds.length > 0
        ? prisma.carePlan.count({
            where: {
              orgId,
              deletedAt: null,
              status: "draft",
              signedAt: null,
              ...scopedPatients,
            },
          })
        : Promise.resolve(0),
      patientIds.length > 0
        ? prisma.escalation.count({
            where: {
              orgId,
              status: { in: [...OPEN_ESCALATION_STATUSES] },
              ...scopedPatients,
            },
          })
        : Promise.resolve(0),
      patientIds.length > 0
        ? prisma.clinicalAlert.count({
            where: {
              orgId,
              isResolved: false,
              severity: "critical",
              ...scopedPatients,
            },
          })
        : Promise.resolve(0),
      prisma.visitReview.count({
        where: { orgId, status: "pending" },
      }),
    ]).then(
      ([
        assignedPatientCount,
        draftOrders,
        carePlansToSign,
        openEscalations,
        criticalAlerts,
        pendingVisitReviews,
      ]) => ({
        assignedPatientCount,
        draftOrders,
        carePlansToSign,
        openEscalations,
        criticalAlerts,
        pendingVisitReviews,
      }),
    ),
    prisma.physicianOrder.findMany({
      where: {
        orgId,
        physicianId,
        deletedAt: null,
        status: "draft",
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: physicianOrderInclude,
    }),
    patientIds.length > 0
      ? prisma.escalation.findMany({
          where: {
            orgId,
            status: { in: [...OPEN_ESCALATION_STATUSES] },
            ...scopedPatients,
          },
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
          take: 6,
          include: { patient: { select: { id: true, fullName: true } } },
        })
      : Promise.resolve([]),
    patientIds.length > 0
      ? prisma.carePlan.findMany({
          where: {
            orgId,
            deletedAt: null,
            status: "draft",
            signedAt: null,
            ...scopedPatients,
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          include: {
            patient: { select: { id: true, fullName: true } },
            author: { select: { id: true, fullName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    counts,
    assignedPatients,
    recentDraftOrders,
    recentEscalations,
    carePlansPendingSign,
  };
}
