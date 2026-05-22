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
  escalationInclude,
  getOrgEscalationOrThrow,
} from "@/lib/clinical-reviews";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  status: z.enum(["open", "in_review", "resolved", "cancelled"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  clinicalResponse: z.string().max(4000).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(4000).optional(),
});

export const GET = withOrgAccess(async (_req: NextRequest, ctx, auth) => {
  try {
    const escalation = await getOrgEscalationOrThrow(
      auth.orgId!,
      ctx.params.escalationId,
    );
    return success(escalation);
  } catch (err) {
    if (err instanceof Error && err.message === "ESCALATION_NOT_FOUND") {
      return notFound("Escalation");
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

    const existing = await getOrgEscalationOrThrow(
      auth.orgId!,
      ctx.params.escalationId,
    );

    if (parsed.data.assignedToId) {
      await ensureOrgAssignee(auth.orgId!, parsed.data.assignedToId);
    }

    const status = parsed.data.status;
    let resolvedAt: Date | null | undefined;
    if (status === "resolved") {
      resolvedAt = new Date();
    } else if (status) {
      resolvedAt = null;
    }

    const updated = await prisma.escalation.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.description && { description: parsed.data.description }),
        ...(parsed.data.severity && { severity: parsed.data.severity }),
        ...(parsed.data.clinicalResponse !== undefined && {
          clinicalResponse: parsed.data.clinicalResponse,
        }),
        ...(parsed.data.assignedToId !== undefined && {
          assignedToId: parsed.data.assignedToId,
        }),
        ...(status && { status }),
        ...(resolvedAt !== undefined && { resolvedAt }),
        ...(status === "in_review" &&
          !existing.assignedToId &&
          parsed.data.assignedToId === undefined && {
            assignedToId: auth.userId,
          }),
      },
      include: escalationInclude,
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "status_changed",
      resourceType: "escalation",
      resourceId: updated.id,
      patientId: updated.patientId,
      metadata: { status: updated.status, severity: updated.severity },
      req,
    });

    return success(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "REVIEW_FORBIDDEN") {
        return error("Only clinical reviewers can update escalations", 403);
      }
      if (err.message === "ESCALATION_NOT_FOUND") return notFound("Escalation");
      if (err.message === "ASSIGNEE_NOT_IN_ORG") {
        return error("Assignee must belong to this organization", 400);
      }
    }
    return serverError(err);
  }
});
