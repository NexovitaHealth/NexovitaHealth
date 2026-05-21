-- CreateEnum
CREATE TYPE "VisitReviewStatus" AS ENUM ('pending', 'approved', 'needs_correction', 'rejected');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('draft', 'queued', 'submitted', 'paid', 'denied', 'voided');

-- CreateTable
CREATE TABLE "visit_reviews" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "visit_log_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "status" "VisitReviewStatus" NOT NULL DEFAULT 'pending',
    "clinical_notes" TEXT,
    "correction_reason" TEXT,
    "billing_hold_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "visit_log_id" TEXT NOT NULL,
    "authorisation_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "claim_number" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'draft',
    "payer_name" TEXT NOT NULL,
    "service_code" TEXT NOT NULL,
    "service_date" TIMESTAMP(3) NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "unit_type" TEXT NOT NULL DEFAULT 'visit',
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "diagnosis_codes" JSONB NOT NULL DEFAULT '[]',
    "procedure_codes" JSONB NOT NULL DEFAULT '[]',
    "denial_reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "queued_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "denied_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_reviews_visit_log_id_key" ON "visit_reviews"("visit_log_id");

-- CreateIndex
CREATE INDEX "visit_reviews_org_id_idx" ON "visit_reviews"("org_id");

-- CreateIndex
CREATE INDEX "visit_reviews_patient_id_idx" ON "visit_reviews"("patient_id");

-- CreateIndex
CREATE INDEX "visit_reviews_reviewed_by_id_idx" ON "visit_reviews"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "visit_reviews_status_idx" ON "visit_reviews"("status");

-- CreateIndex
CREATE UNIQUE INDEX "claims_visit_log_id_key" ON "claims"("visit_log_id");

-- CreateIndex
CREATE INDEX "claims_org_id_idx" ON "claims"("org_id");

-- CreateIndex
CREATE INDEX "claims_patient_id_idx" ON "claims"("patient_id");

-- CreateIndex
CREATE INDEX "claims_authorisation_id_idx" ON "claims"("authorisation_id");

-- CreateIndex
CREATE INDEX "claims_created_by_id_idx" ON "claims"("created_by_id");

-- CreateIndex
CREATE INDEX "claims_status_idx" ON "claims"("status");

-- CreateIndex
CREATE INDEX "claims_service_date_idx" ON "claims"("service_date");

-- CreateIndex
CREATE INDEX "claims_deleted_at_idx" ON "claims"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "claims_org_id_claim_number_key" ON "claims"("org_id", "claim_number");

-- AddForeignKey
ALTER TABLE "visit_reviews" ADD CONSTRAINT "visit_reviews_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_reviews" ADD CONSTRAINT "visit_reviews_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_reviews" ADD CONSTRAINT "visit_reviews_visit_log_id_fkey" FOREIGN KEY ("visit_log_id") REFERENCES "visit_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_reviews" ADD CONSTRAINT "visit_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_visit_log_id_fkey" FOREIGN KEY ("visit_log_id") REFERENCES "visit_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_authorisation_id_fkey" FOREIGN KEY ("authorisation_id") REFERENCES "payer_authorisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill the nurse review queue for visits that were already submitted before
-- the approval workflow existed. These remain pending until a reviewer approves
-- or sends them back for correction.
INSERT INTO "visit_reviews" (
    "id",
    "org_id",
    "patient_id",
    "visit_log_id",
    "status",
    "created_at",
    "updated_at"
)
SELECT
    'review_' || "id",
    "org_id",
    "patient_id",
    "id",
    'pending',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "visit_logs"
WHERE "submitted_at" IS NOT NULL
  AND "deleted_at" IS NULL
ON CONFLICT ("visit_log_id") DO NOTHING;
