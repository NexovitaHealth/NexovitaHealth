-- CreateEnum
CREATE TYPE "ClinicalReviewStatus" AS ENUM ('open', 'in_review', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "PhysicianOrderStatus" AS ENUM ('draft', 'active', 'completed', 'discontinued', 'cancelled');

-- CreateEnum
CREATE TYPE "VisitTaskStatus" AS ENUM ('pending', 'completed', 'skipped', 'refused');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('reported', 'triaged', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "FamilyCaregiverStatus" AS ENUM ('pending', 'approved', 'revoked', 'rejected');

-- CreateEnum
CREATE TYPE "PayerAuthorisationStatus" AS ENUM ('active', 'pending', 'exhausted', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "physician_orders" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "physician_id" TEXT NOT NULL,
    "care_plan_id" TEXT,
    "escalation_id" TEXT,
    "order_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "status" "PhysicianOrderStatus" NOT NULL DEFAULT 'draft',
    "effective_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "discontinued_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physician_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "source_vital_id" TEXT,
    "source_visit_id" TEXT,
    "incident_id" TEXT,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'warning',
    "status" "ClinicalReviewStatus" NOT NULL DEFAULT 'open',
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clinical_response" TEXT,
    "resolved_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "visit_log_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "completed_by_id" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "category" TEXT,
    "status" "VisitTaskStatus" NOT NULL DEFAULT 'pending',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "visit_log_id" TEXT,
    "reported_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "incident_type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'warning',
    "status" "IncidentStatus" NOT NULL DEFAULT 'reported',
    "description" TEXT NOT NULL,
    "immediate_action" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_caregiver_accounts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "relationship" TEXT NOT NULL,
    "status" "FamilyCaregiverStatus" NOT NULL DEFAULT 'pending',
    "access_level" TEXT NOT NULL DEFAULT 'read_only',
    "can_view_schedule" BOOLEAN NOT NULL DEFAULT true,
    "can_view_care_plan" BOOLEAN NOT NULL DEFAULT true,
    "can_view_vitals" BOOLEAN NOT NULL DEFAULT true,
    "can_message_care_team" BOOLEAN NOT NULL DEFAULT true,
    "approved_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_caregiver_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payer_authorisations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "payer_name" TEXT NOT NULL,
    "payer_type" TEXT,
    "authorisation_number" TEXT NOT NULL,
    "service_code" TEXT,
    "status" "PayerAuthorisationStatus" NOT NULL DEFAULT 'pending',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "units_authorised" INTEGER NOT NULL,
    "units_used" INTEGER NOT NULL DEFAULT 0,
    "unit_type" TEXT NOT NULL DEFAULT 'visit',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payer_authorisations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "physician_orders_org_id_idx" ON "physician_orders"("org_id");

-- CreateIndex
CREATE INDEX "physician_orders_patient_id_idx" ON "physician_orders"("patient_id");

-- CreateIndex
CREATE INDEX "physician_orders_physician_id_idx" ON "physician_orders"("physician_id");

-- CreateIndex
CREATE INDEX "physician_orders_status_idx" ON "physician_orders"("status");

-- CreateIndex
CREATE INDEX "physician_orders_deleted_at_idx" ON "physician_orders"("deleted_at");

-- CreateIndex
CREATE INDEX "escalations_org_id_idx" ON "escalations"("org_id");

-- CreateIndex
CREATE INDEX "escalations_patient_id_idx" ON "escalations"("patient_id");

-- CreateIndex
CREATE INDEX "escalations_created_by_id_idx" ON "escalations"("created_by_id");

-- CreateIndex
CREATE INDEX "escalations_assigned_to_id_idx" ON "escalations"("assigned_to_id");

-- CreateIndex
CREATE INDEX "escalations_status_severity_idx" ON "escalations"("status", "severity");

-- CreateIndex
CREATE INDEX "escalations_deleted_at_idx" ON "escalations"("deleted_at");

-- CreateIndex
CREATE INDEX "visit_tasks_org_id_idx" ON "visit_tasks"("org_id");

-- CreateIndex
CREATE INDEX "visit_tasks_patient_id_idx" ON "visit_tasks"("patient_id");

-- CreateIndex
CREATE INDEX "visit_tasks_visit_log_id_idx" ON "visit_tasks"("visit_log_id");

-- CreateIndex
CREATE INDEX "visit_tasks_assigned_to_id_idx" ON "visit_tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "visit_tasks_status_idx" ON "visit_tasks"("status");

-- CreateIndex
CREATE INDEX "incidents_org_id_idx" ON "incidents"("org_id");

-- CreateIndex
CREATE INDEX "incidents_patient_id_idx" ON "incidents"("patient_id");

-- CreateIndex
CREATE INDEX "incidents_visit_log_id_idx" ON "incidents"("visit_log_id");

-- CreateIndex
CREATE INDEX "incidents_reported_by_id_idx" ON "incidents"("reported_by_id");

-- CreateIndex
CREATE INDEX "incidents_assigned_to_id_idx" ON "incidents"("assigned_to_id");

-- CreateIndex
CREATE INDEX "incidents_status_severity_idx" ON "incidents"("status", "severity");

-- CreateIndex
CREATE INDEX "incidents_deleted_at_idx" ON "incidents"("deleted_at");

-- CreateIndex
CREATE INDEX "family_caregiver_accounts_org_id_idx" ON "family_caregiver_accounts"("org_id");

-- CreateIndex
CREATE INDEX "family_caregiver_accounts_patient_id_idx" ON "family_caregiver_accounts"("patient_id");

-- CreateIndex
CREATE INDEX "family_caregiver_accounts_user_id_idx" ON "family_caregiver_accounts"("user_id");

-- CreateIndex
CREATE INDEX "family_caregiver_accounts_status_idx" ON "family_caregiver_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "family_caregiver_accounts_patient_id_user_id_key" ON "family_caregiver_accounts"("patient_id", "user_id");

-- CreateIndex
CREATE INDEX "payer_authorisations_org_id_idx" ON "payer_authorisations"("org_id");

-- CreateIndex
CREATE INDEX "payer_authorisations_patient_id_idx" ON "payer_authorisations"("patient_id");

-- CreateIndex
CREATE INDEX "payer_authorisations_status_idx" ON "payer_authorisations"("status");

-- CreateIndex
CREATE INDEX "payer_authorisations_end_date_idx" ON "payer_authorisations"("end_date");

-- CreateIndex
CREATE INDEX "payer_authorisations_deleted_at_idx" ON "payer_authorisations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payer_authorisations_org_id_authorisation_number_key" ON "payer_authorisations"("org_id", "authorisation_number");

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_physician_id_fkey" FOREIGN KEY ("physician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physician_orders" ADD CONSTRAINT "physician_orders_escalation_id_fkey" FOREIGN KEY ("escalation_id") REFERENCES "escalations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_source_vital_id_fkey" FOREIGN KEY ("source_vital_id") REFERENCES "patient_vitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_source_visit_id_fkey" FOREIGN KEY ("source_visit_id") REFERENCES "visit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_visit_log_id_fkey" FOREIGN KEY ("visit_log_id") REFERENCES "visit_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_tasks" ADD CONSTRAINT "visit_tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_visit_log_id_fkey" FOREIGN KEY ("visit_log_id") REFERENCES "visit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_caregiver_accounts" ADD CONSTRAINT "family_caregiver_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_caregiver_accounts" ADD CONSTRAINT "family_caregiver_accounts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_caregiver_accounts" ADD CONSTRAINT "family_caregiver_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_caregiver_accounts" ADD CONSTRAINT "family_caregiver_accounts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer_authorisations" ADD CONSTRAINT "payer_authorisations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer_authorisations" ADD CONSTRAINT "payer_authorisations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
