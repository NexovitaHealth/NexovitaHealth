import type { UserRole } from "@prisma/client";
import { familyCaregiverInclude } from "@/lib/portal";
import type { AuthContext } from "@/lib/middleware";
import { assertCaregiverManageAccess } from "@/lib/rbac";

export { familyCaregiverInclude };

export function assertFamilyCaregiverManager(
  roleOrAuth: UserRole | Pick<AuthContext, "user" | "orgRole">,
  orgRole?: string,
) {
  if (typeof roleOrAuth === "object" && "user" in roleOrAuth) {
    assertCaregiverManageAccess(roleOrAuth);
    return;
  }
  const role = roleOrAuth as UserRole;
  const orgOk = orgRole && ["owner", "admin"].includes(orgRole);
  const userOk = ["agency_admin", "supervisor", "owner"].includes(role);
  if (!orgOk && !userOk) {
    throw new Error("FAMILY_CAREGIVER_FORBIDDEN");
  }
}
