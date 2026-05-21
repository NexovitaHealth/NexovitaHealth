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
  evaluateEvv,
  getExpectedVisitLocation,
  getOrgVisitOrThrow,
  ensureVisitUnlocked,
} from "@/lib/visits";

export const dynamic = "force-dynamic";

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  checkedInAt: z.string().datetime().optional(),
  radiusMeters: z.number().positive().max(5000).optional(),
});

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
      return forbidden("You cannot check in for this visit");
    }

    if (visit.status !== "scheduled") {
      return error("Only scheduled visits can be checked in", 409);
    }

    const body = await req.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const expected = getExpectedVisitLocation(visit);
    const evv = evaluateEvv(
      { latitude: parsed.data.latitude, longitude: parsed.data.longitude },
      expected,
      parsed.data.radiusMeters,
    );

    const updated = await prisma.visitLog.update({
      where: { id: visit.id },
      data: {
        status: "in_progress",
        checkinAt: parsed.data.checkedInAt
          ? new Date(parsed.data.checkedInAt)
          : new Date(),
        checkinLatitude: parsed.data.latitude,
        checkinLongitude: parsed.data.longitude,
        checkinDistanceMeters: evv.distanceMeters,
        evvVerified: evv.verified,
        evvFlagReason: evv.flagReason,
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
        status: "in_progress",
        evvVerified: evv.verified,
        distanceMeters: evv.distanceMeters,
        flagReason: evv.flagReason,
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
