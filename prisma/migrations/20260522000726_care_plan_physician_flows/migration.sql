-- CreateEnum
CREATE TYPE "CarePlanStatus" AS ENUM ('draft', 'active', 'superseded', 'expired', 'discontinued');

-- AlterTable
ALTER TABLE "care_plans" ADD COLUMN     "org_id" TEXT,
ADD COLUMN     "parent_care_plan_id" TEXT,
ADD COLUMN     "signature_hash" TEXT,
ADD COLUMN     "signature_meaning" TEXT,
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "signed_by_id" TEXT,
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "care_plans" AS care_plan
SET
  "org_id" = patient."org_id",
  "signed_at" = care_plan."approved_at",
  "signed_by_id" = CASE
    WHEN care_plan."approved_by" IS NOT NULL
      AND EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = care_plan."approved_by")
    THEN care_plan."approved_by"
    ELSE NULL
  END
FROM "patients" AS patient
WHERE care_plan."patient_id" = patient."id";

ALTER TABLE "care_plans" ALTER COLUMN "org_id" SET NOT NULL;

ALTER TABLE "care_plans"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "CarePlanStatus" USING (
  CASE
    WHEN "status" IN ('draft', 'active', 'superseded', 'expired', 'discontinued')
      THEN "status"::"CarePlanStatus"
    WHEN "status" = 'archived'
      THEN 'superseded'::"CarePlanStatus"
    ELSE 'draft'::"CarePlanStatus"
  END
),
ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "care_plans" DROP COLUMN "approved_at",
DROP COLUMN "approved_by";

-- AlterTable
ALTER TABLE "physician_orders" ADD COLUMN     "signature_hash" TEXT,
ADD COLUMN     "signature_meaning" TEXT;

-- CreateIndex
CREATE INDEX "care_plans_org_id_idx" ON "care_plans"("org_id");

-- CreateIndex
CREATE INDEX "care_plans_author_id_idx" ON "care_plans"("author_id");

-- CreateIndex
CREATE INDEX "care_plans_signed_by_id_idx" ON "care_plans"("signed_by_id");

-- CreateIndex
CREATE INDEX "care_plans_parent_care_plan_id_idx" ON "care_plans"("parent_care_plan_id");

-- CreateIndex
CREATE INDEX "care_plans_status_idx" ON "care_plans"("status");

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_parent_care_plan_id_fkey" FOREIGN KEY ("parent_care_plan_id") REFERENCES "care_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
