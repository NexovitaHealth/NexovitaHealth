import { OrgRole, UserRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION MATRIX
// This is the single source of truth for all authorization decisions.
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSIONS: Record<string, readonly string[]> = {
  // Patient operations
  'patient:create':    ['agency_admin', 'supervisor', 'physician'],
  'patient:read':      ['agency_admin', 'supervisor', 'physician', 'physician_independent', 'aide', 'billing_manager', 'family_caregiver'],
  'patient:update':    ['agency_admin', 'supervisor', 'physician'],
  'patient:delete':    ['agency_admin'],
  'patient:discharge': ['agency_admin', 'supervisor', 'physician'],
  
  // Clinical operations
  'vital:create':      ['agency_admin', 'supervisor', 'physician', 'aide'],
  'vital:read':        ['agency_admin', 'supervisor', 'physician', 'aide'],
  'careplan:create':   ['agency_admin', 'supervisor', 'physician'],
  'careplan:approve':  ['supervisor', 'physician'],
  'medication:prescribe': ['physician', 'physician_independent'],
  'lab:order':         ['physician', 'physician_independent', 'supervisor'],
  
  // Visit operations
  'visit:create':      ['agency_admin', 'supervisor', 'aide'],
  'visit:checkin':     ['aide'],
  'visit:checkout':    ['aide'],
  
  // Organization management
  'org:invite_member': ['agency_admin', 'agency_admin'],
  'org:remove_member': ['agency_admin', 'agency_admin'],
  'org:update_settings': ['agency_admin', 'agency_admin'],
  'org:delete':        ['agency_admin'],
  'org:create_project': ['agency_admin', 'agency_admin', 'aide'],
  
  // Task operations
  'task:create':       ['agency_admin', 'agency_admin', 'aide'],
  'task:update':       ['agency_admin', 'agency_admin', 'aide'],
  'task:delete':       ['agency_admin', 'agency_admin'],
  'task:read':         ['agency_admin', 'agency_admin', 'aide', 'guest'],
  
  // Reports / Billing
  'report:view':       ['agency_admin', 'supervisor', 'billing_manager'],
  'billing:export':    ['agency_admin', 'billing_manager'],
  
  // Admin
  'audit:read':        ['agency_admin', 'superadmin'],
  'user:manage':       ['agency_admin'],
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasUserRolePermission(
  userRole: UserRole,
  permission: Permission
): boolean {
  const allowed = PERMISSIONS[permission] as string[]
  return allowed.includes(userRole)
}

export function hasOrgRolePermission(
  orgRole: OrgRole,
  permission: Permission
): boolean {
  const allowed = PERMISSIONS[permission] as string[]
  return allowed.includes(orgRole)
}

export function canUserPerform(
  userRole: UserRole,
  orgRole: OrgRole | null,
  permission: Permission
): boolean {
  const allowed = PERMISSIONS[permission] as string[]
  return allowed.includes(userRole) || (orgRole !== null && allowed.includes(orgRole))
}

// Role display helpers
export const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Platform Admin',
  agency_admin: 'Agency Admin',
  supervisor: 'Supervisor',
  physician: 'Physician',
  physician_independent: 'Independent Physician',
  aide: 'Home Aide',
  billing_manager: 'Billing Manager',
  patient: 'Patient',
  family_caregiver: 'Family Caregiver',
  school_nurse: 'School Nurse',
}

export const ORG_ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
}
