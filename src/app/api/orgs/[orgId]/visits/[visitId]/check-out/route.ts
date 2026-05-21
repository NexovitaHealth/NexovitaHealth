import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  forbidden,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  canPerformVisitAction,
  ensureVisitUnlocked,
  evaluateEvv,
  getExpectedVisitLocation,
  getOrgVisitOrThrow,
} from "@/lib/visits";

export const dynamic = "force-dynamic";

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  checkedOutAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  radiusMeters: z.number().positive().max(5000).optional(),
});

function getDurationMinutes(checkinAt: Date, checkoutAt: Date) {
  return Math.max(0, Math.round((checkoutAt.getTime() - checkinAt.getTime()) / 60000));
}

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    const visit = await getOrgVisitOrThrow(auth.orgId!, ctx.params.visitId);
    ensureVisitUnlocked(visit);

    if (
      !canPerformVisitAction(visit, {
        userId: auth.userId,
        orgRole: auth.orgRole,
        userRole: auth.user.role,
      })
    ) {
      return forbidden("You cannot check out for this visit");
    }

    if (visit.status !== "in_progress" || !visit.checkinAt) {
      return error("Only checked-in visits can be checked out", 409);
    }

    const body = await req.json();
    const parsed = checkOutSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const checkoutAt = parsed.data.checkedOutAt
      ? new Date(parsed.data.checkedOutAt)
      : new Date();
    const expected = getExpectedVisitLocation(visit);
    const evv = evaluateEvv(
      { latitude: parsed.data.latitude, longitude: parsed.data.longitude },
      expected,
      parsed.data.radiusMeters,
    );

    const updated = await prisma.visitLog.update({
      where: { id: visit.id },
      data: {
        status: "completed",
        checkoutAt,
        durationMinutes: getDurationMinutes(visit.checkinAt, checkoutAt),
        checkoutLatitude: parsed.data.latitude,
        checkoutLongitude: parsed.data.longitude,
        checkoutDistanceMeters: evv.distanceMeters,
        evvVerified: visit.evvVerified && evv.verified,
        evvFlagReason:
          visit.evvFlagReason ?? evv.flagReason ?? null,
        notes: parsed.data.notes ?? visit.notes,
      },
      include: {
        patient: { select: { id: true, fullName: true } },
        loggedBy: { select: { id: true, fullName: true } },
        visitTasks: { orderBy: { position: "asc" } },
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "status_changed",
      resourceType: "visit",
      resourceId: visit.id,
      patientId: visit.patientId,
      metadata: {
        status: "completed",
        evvVerified: updated.evvVerified,
        distanceMeters: evv.distanceMeters,
        flagReason: updated.evvFlagReason,
      },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "VISIT_NOT_FOUND") return notFound("Visit");
      if (err.message === "VISIT_LOCKED") return error("Visit is locked", 409);
    }
    return serverError(err);
  }
});
