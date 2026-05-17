/**
 * Type definitions that mirror the Prisma schema enums.
 * These avoid importing from @prisma/client which may not be generated in CI/offline environments.
 * Source of truth is always prisma/schema.prisma
 */

export type UserRole =
  | 'superadmin'
  | 'agency_admin'
  | 'supervisor'
  | 'physician'
  | 'physician_independent'
  | 'aide'
  | 'billing_manager'
  | 'patient'
  | 'family_caregiver'
  | 'school_nurse'

export type OrgRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'guest'

export type PatientStatus =
  | 'intake'
  | 'active'
  | 'on_hold'
  | 'discharged'
  | 'deceased'

export type VisitStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'cancelled'

export type RiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'cancelled'

export type TaskPriority =
  | 'urgent'
  | 'high'
  | 'medium'
  | 'low'

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'viewed'
  | 'exported'
  | 'invited'
  | 'removed'
  | 'status_changed'
  | 'file_uploaded'
  | 'file_deleted'
  | 'login'
  | 'logout'
  | 'password_changed'

export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'cancelled'

export type AlertSeverity =
  | 'info'
  | 'warning'
  | 'critical'

// Role label maps for display
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  agency_admin: 'Agency Admin',
  supervisor: 'Supervisor',
  physician: 'Physician',
  physician_independent: 'Independent Physician',
  aide: 'Aide',
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
  agency_admin: 'Agency Admin',
  supervisor: 'Supervisor',
  physician: 'Physician',
  aide: 'Aide',
  billing_manager: 'Billing Manager',
  school_nurse: 'School Nurse',
}
