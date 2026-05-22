import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  error,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import {
  assertClinicalReviewer,
  ensureOrgAssignee,
  getOrgIncidentOrThrow,
  incidentInclude,
} from "@/lib/clinical-reviews";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.enum(["reported", "triaged", "resolved", "closed"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  immediateAction: z.string().max(2000).nullable().optional(),
  resolution: z.string().max(4000).nullable().optional(),
});

export const GET = withOrgAccess(async (_req: NextRequest, ctx, auth) => {
  try {
    const incident = await getOrgIncidentOrThrow(
      auth.orgId!,
      ctx.params.incidentId,
    );
    return success(incident);
  } catch (err) {
    if (err instanceof Error && err.message === "INCIDENT_NOT_FOUND") {
      return notFound("Incident");
    }
    return serverError(err);
  }
});

export const PATCH = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    assertClinicalReviewer(auth);

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await getOrgIncidentOrThrow(
      auth.orgId!,
      ctx.params.incidentId,
    );

    if (parsed.data.assignedToId) {
      await ensureOrgAssignee(auth.orgId!, parsed.data.assignedToId);
    }

    const status = parsed.data.status;
    let resolvedAt: Date | null | undefined;
    if (status === "resolved" || status === "closed") {
      resolvedAt = new Date();
    } else if (status) {
      resolvedAt = null;
    }

    const updated = await prisma.incident.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.severity && { severity: parsed.data.severity }),
        ...(parsed.data.immediateAction !== undefined && {
          immediateAction: parsed.data.immediateAction,
        }),
        ...(parsed.data.resolution !== undefined && {
          resolution: parsed.data.resolution,
        }),
        ...(parsed.data.assignedToId !== undefined && {
          assignedToId: parsed.data.assignedToId,
        }),
        ...(status && { status }),
        ...(resolvedAt !== undefined && { resolvedAt }),
        ...(status === "triaged" &&
          !existing.assignedToId &&
          parsed.data.assignedToId === undefined && {
            assignedToId: auth.userId,
          }),
      },
      include: incidentInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "status_changed",
      resourceType: "incident",
      resourceId: updated.id,
      patientId: updated.patientId,
      metadata: { status: updated.status },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "REVIEW_FORBIDDEN") {
        return error("Only clinical reviewers can update incidents", 403);
      }
      if (err.message === "INCIDENT_NOT_FOUND") return notFound("Incident");
      if (err.message === "ASSIGNEE_NOT_IN_ORG") {
        return error("Assignee must belong to this organization", 400);
      }
    }
    return serverError(err);
  }
});
