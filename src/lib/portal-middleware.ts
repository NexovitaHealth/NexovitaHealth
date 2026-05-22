import { NextRequest, NextResponse } from "next/server";
import {
  getPortalSessionFromRequest,
  type PortalAuthContext,
} from "@/lib/portal-auth";
import { unauthorized } from "@/lib/api-response";

export interface PortalRouteContext {
  params: Record<string, string>;
}

export function withPortalAccess(
  handler: (
    req: NextRequest,
    ctx: PortalRouteContext,
    portal: PortalAuthContext,
  ) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx: PortalRouteContext) => {
    const portal = await getPortalSessionFromRequest(req);
    if (!portal) {
      return unauthorized("Portal session required");
    }
    return handler(req, ctx, portal);
  };
}
