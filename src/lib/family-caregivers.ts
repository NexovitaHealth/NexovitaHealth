import type { UserRole } from "@prisma/client";
import { familyCaregiverInclude } from "@/lib/portal";

export { familyCaregiverInclude };

export function assertFamilyCaregiverManager(role: UserRole, orgRole?: string) {
  const orgOk = orgRole && ["owner", "admin"].includes(orgRole);
  const userOk = ["agency_admin", "supervisor", "superadmin"].includes(role);
  if (!orgOk && !userOk) {
    throw new Error("FAMILY_CAREGIVER_FORBIDDEN");
  }
}
