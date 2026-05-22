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
  | 'pending'
  | 'in_progress'
  | 'completed'
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

export type ClinicalReviewStatus =
  | 'open'
  | 'in_review'
  | 'resolved'
  | 'cancelled'

export type PhysicianOrderStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'discontinued'
  | 'cancelled'

export type CarePlanStatus =
  | 'draft'
  | 'active'
  | 'superseded'
  | 'expired'
  | 'discontinued'

export type VisitTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'refused'

export type VisitReviewStatus =
  | 'pending'
  | 'approved'
  | 'needs_correction'
  | 'rejected'

export type ClaimStatus =
  | 'draft'
  | 'queued'
  | 'submitted'
  | 'paid'
  | 'denied'
  | 'voided'

export type IncidentStatus =
  | 'reported'
  | 'triaged'
  | 'resolved'
  | 'closed'

export type FamilyCaregiverStatus =
  | 'pending'
  | 'approved'
  | 'revoked'
  | 'rejected'

export type PayerAuthorisationStatus =
  | 'active'
  | 'pending'
  | 'exhausted'
  | 'expired'
  | 'cancelled'

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
