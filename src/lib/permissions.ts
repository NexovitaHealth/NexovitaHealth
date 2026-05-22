import type { OrgRole, UserRole } from "@/types";

/**
 * Single source of truth for authorization.
 * UserRole and OrgRole (owner/admin) may both satisfy an action where listed.
 */
export const PERMISSIONS = {
  "patient:create": [
    "agency_admin",
    "supervisor",
    "physician",
    "owner",
    "admin",
  ],
  "patient:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "billing_manager",
    "school_nurse",
    "owner",
    "admin",
    "member",
  ],
  "patient:update": [
    "agency_admin",
    "supervisor",
    "physician",
    "owner",
    "admin",
  ],
  "patient:delete": ["agency_admin", "owner", "admin"],

  "vital:create": [
    "agency_admin",
    "supervisor",
    "physician",
    "aide",
    "school_nurse",
  ],
  "vital:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "billing_manager",
    "school_nurse",
  ],

  "alert:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "school_nurse",
    "billing_manager",
  ],
  "alert:resolve": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
  ],

  "careplan:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "owner",
    "admin",
  ],
  "careplan:create": [
    "agency_admin",
    "supervisor",
    "physician",
    "owner",
    "admin",
  ],
  "careplan:sign": [
    "physician",
    "physician_independent",
    "agency_admin",
    "supervisor",
  ],

  "physician_order:manage": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
  ],
  "physician:portal": ["physician", "physician_independent"],

  "lab:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "billing_manager",
  ],
  "lab:order": [
    "physician",
    "physician_independent",
    "supervisor",
    "agency_admin",
  ],
  "lab:result": [
    "physician",
    "physician_independent",
    "supervisor",
    "agency_admin",
  ],

  "visit:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "billing_manager",
    "school_nurse",
  ],
  "visit:schedule": ["agency_admin", "supervisor", "owner", "admin"],
  "visit:checkin": ["aide", "school_nurse"],
  "visit:checkout": ["aide", "school_nurse"],
  "visit:submit": ["aide", "school_nurse"],

  "review:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "billing_manager",
  ],
  "review:decide": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
  ],

  "escalation:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
  ],
  "escalation:manage": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
  ],

  "incident:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "school_nurse",
  ],
  "incident:report": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "school_nurse",
  ],
  "incident:manage": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
  ],

  "billing:read": ["agency_admin", "billing_manager", "owner", "admin"],
  "billing:manage": ["agency_admin", "billing_manager", "owner", "admin"],
  "authorisation:manage": [
    "agency_admin",
    "billing_manager",
    "owner",
    "admin",
  ],

  "caregiver:manage": [
    "agency_admin",
    "supervisor",
    "superadmin",
    "owner",
    "admin",
  ],

  "clinical:supervise": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
  ],
  "compliance:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "school_nurse",
    "billing_manager",
  ],

  "org:invite_member": ["agency_admin", "owner", "admin"],
  "org:remove_member": ["agency_admin", "owner", "admin"],
  "org:update_settings": ["agency_admin", "owner", "admin"],

  "task:create": [
    "agency_admin",
    "supervisor",
    "aide",
    "owner",
    "admin",
    "member",
  ],
  "task:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "aide",
    "billing_manager",
    "guest",
    "member",
  ],
  "task:update": [
    "agency_admin",
    "supervisor",
    "aide",
    "owner",
    "admin",
    "member",
  ],
  "task:delete": ["agency_admin", "owner", "admin"],

  "report:view": [
    "agency_admin",
    "supervisor",
    "billing_manager",
    "owner",
    "admin",
  ],
  "billing:export": ["agency_admin", "billing_manager", "owner", "admin"],

  "audit:read": ["agency_admin", "superadmin", "owner", "admin"],
  "user:manage": ["agency_admin", "superadmin", "owner", "admin"],
  "email:admin": ["agency_admin", "superadmin", "owner", "admin"],

  "message:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "school_nurse",
    "billing_manager",
    "owner",
    "admin",
    "member",
  ],
  "message:send": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "school_nurse",
    "owner",
    "admin",
  ],

  "care_team:manage": [
    "agency_admin",
    "supervisor",
    "physician",
    "owner",
    "admin",
  ],

  "medication:read": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "aide",
    "billing_manager",
    "school_nurse",
    "owner",
    "admin",
    "member",
  ],
  "medication:manage": [
    "agency_admin",
    "supervisor",
    "physician",
    "physician_independent",
    "owner",
    "admin",
  ],
} as const satisfies Record<string, readonly string[]>;

export type Permission = keyof typeof PERMISSIONS;

export function canUserPerform(
  userRole: UserRole | string,
  orgRole: OrgRole | string | null | undefined,
  permission: Permission,
): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[];
  if (allowed.includes(userRole)) return true;
  if (orgRole && allowed.includes(orgRole)) return true;
  return false;
}

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Platform Admin",
  agency_admin: "Agency Admin",
  supervisor: "Supervisor",
  physician: "Physician",
  physician_independent: "Independent Physician",
  aide: "Home Aide",
  billing_manager: "Billing Manager",
  patient: "Patient",
  family_caregiver: "Family Caregiver",
  school_nurse: "School Nurse",
};

export const ORG_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  guest: "Guest",
};
