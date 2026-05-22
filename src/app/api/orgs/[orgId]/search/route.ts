import { withOrgAccess } from "@/lib/middleware";
import { success, error, serverError } from "@/lib/api-response";
import {
  searchOrg,
  UNIVERSAL_SEARCH_MIN_LENGTH,
} from "@/lib/universal-search";
import { parseAssignedToMeFilter } from "@/lib/patient-list-scope";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (req, _ctx, auth) => {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < UNIVERSAL_SEARCH_MIN_LENGTH) {
      return error(
        `Query must be at least ${UNIVERSAL_SEARCH_MIN_LENGTH} characters`,
        422,
        {
          q: [`Query must be at least ${UNIVERSAL_SEARCH_MIN_LENGTH} characters`],
        },
      );
    }

    const limit = req.nextUrl.searchParams.get("limit");
    const assignedToMe = parseAssignedToMeFilter(
      auth.user.role,
      req.nextUrl.searchParams.get("assignedToMe"),
    );

    const results = await searchOrg(
      {
        orgId: auth.orgId!,
        userId: auth.userId,
        userRole: auth.user.role,
        orgRole: auth.orgRole,
      },
      q,
      { limit, assignedToMe },
    );

    return success(results);
  } catch (err) {
    return serverError(err);
  }
});
