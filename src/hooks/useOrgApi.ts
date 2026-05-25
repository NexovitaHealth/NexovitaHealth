import { useMemo } from "react";
import { orgApi } from "@/lib/api-client";
import { useAuth } from "./useAuth";

/**
 * Resolves the typed org-scoped API client for the active organization.
 * Prefer this over raw `useApi` path strings for org routes.
 */
export function useOrgApi() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.orgId;
  const client = useMemo(() => (orgId ? orgApi(orgId) : null), [orgId]);
  return { orgId, client };
}
