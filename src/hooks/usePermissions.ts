"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { canUserPerform, type Permission } from "@/lib/permissions";

export function usePermissions() {
  const { user, activeOrg } = useAuth();
  const orgRole = activeOrg?.role ?? null;

  const can = useCallback(
    (permission: Permission) => {
      if (!user?.role) return false;
      return canUserPerform(user.role, orgRole, permission);
    },
    [user?.role, orgRole],
  );

  return { can, userRole: user?.role, orgRole };
}
