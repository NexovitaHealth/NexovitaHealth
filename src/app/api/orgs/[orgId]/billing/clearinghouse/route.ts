import { NextRequest } from "next/server";
import { z } from "zod";
import { withOrgAccess } from "@/lib/middleware";
import { createAuditLog } from "@/lib/audit";
import {
  clearinghouseConfigSchema,
  getOrgClearinghouseConfig,
  saveOrgClearinghouseConfig,
  toPublicClearinghouseConfig,
  validateClearinghouseConfig,
} from "@/lib/clearinghouse";
import {
  error,
  forbidden,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { assertBillingUser } from "@/lib/billing";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (_req: NextRequest, _ctx, auth) => {
  try {
    assertBillingUser(auth);
    const config = await getOrgClearinghouseConfig(auth.orgId!);
    return success({ clearinghouse: toPublicClearinghouseConfig(config) });
  } catch (err) {
    if (err instanceof Error && err.message === "BILLING_FORBIDDEN") {
      return error("Only billing users can view clearinghouse settings", 403);
    }
    return serverError(err);
  }
});

export const PATCH = withOrgAccess(async (req: NextRequest, _ctx, auth) => {
  try {
    assertBillingUser(auth);
    const canManage =
      ["owner", "admin"].includes(auth.orgRole || "") ||
      auth.user.role === "agency_admin";
    if (!canManage) {
      return forbidden("Only organization admins can update clearinghouse settings");
    }

    const body = await req.json();
    const parsed = clearinghouseConfigSchema.safeParse(body.clearinghouse);
    if (!parsed.success) return validationError(parsed.error);

    const validation = validateClearinghouseConfig(parsed.data);
    if (!validation.ok) {
      return error(validation.error, 422);
    }

    await saveOrgClearinghouseConfig(auth.orgId!, parsed.data);

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "updated",
      resourceType: "clearinghouse_settings",
      resourceId: auth.orgId!,
      metadata: {
        transport: parsed.data.transport,
        enabled: parsed.data.enabled,
      },
      req,
    });

    return success({
      clearinghouse: toPublicClearinghouseConfig(parsed.data),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "BILLING_FORBIDDEN") {
      return error("Only billing users can update clearinghouse settings", 403);
    }
    return serverError(err);
  }
});
