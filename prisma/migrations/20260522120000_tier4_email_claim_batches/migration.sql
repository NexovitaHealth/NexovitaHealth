-- CreateEnum
CREATE TYPE "ClaimBatchStatus" AS ENUM ('draft', 'submitted', 'acknowledged', 'rejected');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('queued', 'sent', 'failed', 'bounced');

-- AlterTable
ALTER TABLE "claims" ADD COLUMN "submission_batch_id" TEXT;

-- CreateTable
CREATE TABLE "claim_submission_batches" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "status" "ClaimBatchStatus" NOT NULL DEFAULT 'submitted',
    "claim_count" INTEGER NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "payer_name" TEXT,
    "clearinghouse_ref" TEXT,
    "submitted_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_submission_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_delivery_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "provider_message_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "claims_submission_batch_id_idx" ON "claims"("submission_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_submission_batches_org_id_batch_number_key" ON "claim_submission_batches"("org_id", "batch_number");

-- CreateIndex
CREATE INDEX "claim_submission_batches_org_id_idx" ON "claim_submission_batches"("org_id");

-- CreateIndex
CREATE INDEX "claim_submission_batches_status_idx" ON "claim_submission_batches"("status");

-- CreateIndex
CREATE INDEX "claim_submission_batches_submitted_at_idx" ON "claim_submission_batches"("submitted_at");

-- CreateIndex
CREATE INDEX "email_delivery_logs_org_id_idx" ON "email_delivery_logs"("org_id");

-- CreateIndex
CREATE INDEX "email_delivery_logs_status_idx" ON "email_delivery_logs"("status");

-- CreateIndex
CREATE INDEX "email_delivery_logs_template_idx" ON "email_delivery_logs"("template");

-- CreateIndex
CREATE INDEX "email_delivery_logs_next_retry_at_idx" ON "email_delivery_logs"("next_retry_at");

-- CreateIndex
CREATE INDEX "email_delivery_logs_created_at_idx" ON "email_delivery_logs"("created_at");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_submission_batch_id_fkey" FOREIGN KEY ("submission_batch_id") REFERENCES "claim_submission_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_submission_batches" ADD CONSTRAINT "claim_submission_batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_submission_batches" ADD CONSTRAINT "claim_submission_batches_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
