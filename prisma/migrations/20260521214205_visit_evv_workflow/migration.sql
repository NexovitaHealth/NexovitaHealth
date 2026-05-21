-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

ALTER TYPE "VisitTaskStatus" ADD VALUE IF NOT EXISTS 'in_progress';

-- AlterTable
ALTER TABLE "visit_logs" ADD COLUMN     "checkin_distance_meters" DOUBLE PRECISION,
ADD COLUMN     "checkin_latitude" DOUBLE PRECISION,
ADD COLUMN     "checkin_longitude" DOUBLE PRECISION,
ADD COLUMN     "checkout_distance_meters" DOUBLE PRECISION,
ADD COLUMN     "checkout_latitude" DOUBLE PRECISION,
ADD COLUMN     "checkout_longitude" DOUBLE PRECISION,
ADD COLUMN     "evv_flag_reason" TEXT,
ADD COLUMN     "evv_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "org_id" TEXT,
ADD COLUMN     "service_address" TEXT,
ADD COLUMN     "service_latitude" DOUBLE PRECISION,
ADD COLUMN     "service_longitude" DOUBLE PRECISION,
ADD COLUMN     "submitted_at" TIMESTAMP(3);

UPDATE "visit_logs" AS visit
SET "org_id" = patient."org_id"
FROM "patients" AS patient
WHERE visit."patient_id" = patient."id";

ALTER TABLE "visit_logs" ALTER COLUMN "org_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "visit_logs_org_id_idx" ON "visit_logs"("org_id");

-- CreateIndex
CREATE INDEX "visit_logs_status_idx" ON "visit_logs"("status");

-- AddForeignKey
ALTER TABLE "visit_logs" ADD CONSTRAINT "visit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
