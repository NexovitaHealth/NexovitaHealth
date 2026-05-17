-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('superadmin', 'agency_admin', 'supervisor', 'physician', 'physician_independent', 'aide', 'billing_manager', 'patient', 'family_caregiver', 'school_nurse');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member', 'guest');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('active', 'discharged', 'deceased', 'on_hold', 'intake');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('created', 'updated', 'deleted', 'viewed', 'exported', 'invited', 'removed', 'status_changed', 'file_uploaded', 'file_deleted', 'login', 'logout', 'password_changed');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'patient',
    "avatar_url" TEXT,
    "license_number" TEXT,
    "license_type" TEXT,
    "license_expiry" TIMESTAMP(3),
    "license_verified" BOOLEAN NOT NULL DEFAULT false,
    "npi_number" TEXT,
    "specializations" TEXT,
    "years_experience" INTEGER,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "country" TEXT NOT NULL DEFAULT 'us',
    "whatsapp_number" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "registration_number" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'us',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "care_settings" JSONB NOT NULL DEFAULT '[]',
    "medicare_provider_number" TEXT,
    "npi_number" TEXT,
    "ghana_facility_code" TEXT,
    "nhia_provider_number" TEXT,
    "subscription_tier" TEXT NOT NULL DEFAULT 'agency',
    "subscription_currency" TEXT NOT NULL DEFAULT 'USD',
    "twilio_whatsapp_number" TEXT,
    "supervisor_whatsapp" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'member',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_branches" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "checkin_time" TEXT NOT NULL DEFAULT '07:30',
    "summary_time" TEXT NOT NULL DEFAULT '20:00',
    "national_health_system" TEXT,
    "primary_care_setting" TEXT,
    "supervising_nurse" TEXT,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "features" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "full_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "photo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "emergency_contact" TEXT,
    "emergency_phone" TEXT,
    "primary_diagnosis" TEXT,
    "secondary_diagnoses" JSONB NOT NULL DEFAULT '[]',
    "allergies" JSONB NOT NULL DEFAULT '[]',
    "blood_type" TEXT,
    "insurance_provider" TEXT,
    "insurance_number" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'intake',
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'low',
    "admission_date" TIMESTAMP(3),
    "discharge_date" TIMESTAMP(3),
    "is_home_care" BOOLEAN NOT NULL DEFAULT false,
    "is_hospice" BOOLEAN NOT NULL DEFAULT false,
    "is_palliative" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_number" TEXT,
    "is_draft" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_care_teams" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "patient_care_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_vitals" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "systolic_bp" INTEGER,
    "diastolic_bp" INTEGER,
    "heart_rate" INTEGER,
    "respiratory_rate" INTEGER,
    "temperature" DOUBLE PRECISION,
    "oxygen_saturation" INTEGER,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "blood_glucose" DOUBLE PRECISION,
    "pain_score" INTEGER,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_logs" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "logged_by_id" TEXT NOT NULL,
    "visit_type" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "checkin_at" TIMESTAMP(3),
    "checkout_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "adl_bathing" BOOLEAN,
    "adl_grooming" BOOLEAN,
    "adl_dressing" BOOLEAN,
    "adl_mobility" BOOLEAN,
    "adl_feeding" BOOLEAN,
    "mood" TEXT,
    "overall_status" TEXT,
    "notes" TEXT,
    "signature_url" TEXT,
    "is_open_shift" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "color" TEXT NOT NULL DEFAULT '#028090',
    "created_by_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_columns" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',

    CONSTRAINT "task_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT,
    "column_id" TEXT,
    "patient_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "position" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "labels" JSONB NOT NULL DEFAULT '[]',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goals" JSONB NOT NULL DEFAULT '[]',
    "interventions" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "review_date" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_medications" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "prescribed_by_id" TEXT,
    "name" TEXT NOT NULL,
    "generic_name" TEXT,
    "dosage" TEXT,
    "frequency" TEXT,
    "route" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "instructions" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dose_logs" (
    "id" TEXT NOT NULL,
    "medication_id" TEXT NOT NULL,
    "administered_by" TEXT,
    "scheduled_time" TEXT,
    "administered_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dose_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "ordered_by_id" TEXT NOT NULL,
    "panel_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "priority" TEXT NOT NULL DEFAULT 'routine',
    "notes" TEXT,
    "result_url" TEXT,
    "resulted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "lab_order_id" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "reference_min" TEXT,
    "reference_max" TEXT,
    "is_abnormal" BOOLEAN NOT NULL DEFAULT false,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_attachments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "task_id" TEXT,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT,
    "document_type" TEXT,
    "description" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "patient_id" TEXT,
    "task_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'internal',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_alerts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "vital_id" TEXT,
    "alert_type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'warning',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "title" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "visit_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recur_rule" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");

-- CreateIndex
CREATE INDEX "org_memberships_org_id_idx" ON "org_memberships"("org_id");

-- CreateIndex
CREATE INDEX "org_memberships_user_id_idx" ON "org_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_memberships_user_id_org_id_key" ON "org_memberships"("user_id", "org_id");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_org_id_idx" ON "invitations"("org_id");

-- CreateIndex
CREATE INDEX "org_branches_org_id_idx" ON "org_branches"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_settings_org_id_key" ON "org_settings"("org_id");

-- CreateIndex
CREATE INDEX "patients_org_id_idx" ON "patients"("org_id");

-- CreateIndex
CREATE INDEX "patients_status_idx" ON "patients"("status");

-- CreateIndex
CREATE INDEX "patients_risk_level_idx" ON "patients"("risk_level");

-- CreateIndex
CREATE INDEX "patients_deleted_at_idx" ON "patients"("deleted_at");

-- CreateIndex
CREATE INDEX "patient_care_teams_patient_id_idx" ON "patient_care_teams"("patient_id");

-- CreateIndex
CREATE INDEX "patient_care_teams_user_id_idx" ON "patient_care_teams"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_care_teams_patient_id_user_id_key" ON "patient_care_teams"("patient_id", "user_id");

-- CreateIndex
CREATE INDEX "patient_vitals_patient_id_idx" ON "patient_vitals"("patient_id");

-- CreateIndex
CREATE INDEX "patient_vitals_recorded_at_idx" ON "patient_vitals"("recorded_at");

-- CreateIndex
CREATE INDEX "visit_logs_patient_id_idx" ON "visit_logs"("patient_id");

-- CreateIndex
CREATE INDEX "visit_logs_logged_by_id_idx" ON "visit_logs"("logged_by_id");

-- CreateIndex
CREATE INDEX "visit_logs_scheduled_at_idx" ON "visit_logs"("scheduled_at");

-- CreateIndex
CREATE INDEX "projects_org_id_idx" ON "projects"("org_id");

-- CreateIndex
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

-- CreateIndex
CREATE INDEX "task_columns_project_id_idx" ON "task_columns"("project_id");

-- CreateIndex
CREATE INDEX "tasks_org_id_idx" ON "tasks"("org_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at");

-- CreateIndex
CREATE INDEX "task_assignees_task_id_idx" ON "task_assignees"("task_id");

-- CreateIndex
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_task_id_user_id_key" ON "task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_idx" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "care_plans_patient_id_idx" ON "care_plans"("patient_id");

-- CreateIndex
CREATE INDEX "patient_medications_patient_id_idx" ON "patient_medications"("patient_id");

-- CreateIndex
CREATE INDEX "dose_logs_medication_id_idx" ON "dose_logs"("medication_id");

-- CreateIndex
CREATE INDEX "dose_logs_date_idx" ON "dose_logs"("date");

-- CreateIndex
CREATE INDEX "lab_orders_patient_id_idx" ON "lab_orders"("patient_id");

-- CreateIndex
CREATE INDEX "lab_results_lab_order_id_idx" ON "lab_results"("lab_order_id");

-- CreateIndex
CREATE INDEX "file_attachments_org_id_idx" ON "file_attachments"("org_id");

-- CreateIndex
CREATE INDEX "file_attachments_patient_id_idx" ON "file_attachments"("patient_id");

-- CreateIndex
CREATE INDEX "file_attachments_task_id_idx" ON "file_attachments"("task_id");

-- CreateIndex
CREATE INDEX "patient_documents_patient_id_idx" ON "patient_documents"("patient_id");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_idx" ON "audit_logs"("org_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_patient_id_idx" ON "audit_logs"("patient_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "messages_org_id_idx" ON "messages"("org_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "announcements_org_id_idx" ON "announcements"("org_id");

-- CreateIndex
CREATE INDEX "clinical_alerts_patient_id_is_resolved_idx" ON "clinical_alerts"("patient_id", "is_resolved");

-- CreateIndex
CREATE INDEX "schedules_org_id_idx" ON "schedules"("org_id");

-- CreateIndex
CREATE INDEX "schedules_staff_id_idx" ON "schedules"("staff_id");

-- CreateIndex
CREATE INDEX "schedules_start_time_idx" ON "schedules"("start_time");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_branches" ADD CONSTRAINT "org_branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "org_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_care_teams" ADD CONSTRAINT "patient_care_teams_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_care_teams" ADD CONSTRAINT "patient_care_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_vitals" ADD CONSTRAINT "patient_vitals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_vitals" ADD CONSTRAINT "patient_vitals_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_columns" ADD CONSTRAINT "task_columns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "task_columns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_medications" ADD CONSTRAINT "patient_medications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dose_logs" ADD CONSTRAINT "dose_logs_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "patient_medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_alerts" ADD CONSTRAINT "clinical_alerts_vital_id_fkey" FOREIGN KEY ("vital_id") REFERENCES "patient_vitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
