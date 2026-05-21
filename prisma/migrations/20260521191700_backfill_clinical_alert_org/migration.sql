-- Add org scope to existing clinical alerts using the real patient relationship.
-- The column is introduced nullable first so existing rows can be backfilled safely.
ALTER TABLE "clinical_alerts" ADD COLUMN "org_id" TEXT;

UPDATE "clinical_alerts" AS alert
SET "org_id" = patient."org_id"
FROM "patients" AS patient
WHERE alert."patient_id" = patient."id";

ALTER TABLE "clinical_alerts" ALTER COLUMN "org_id" SET NOT NULL;

CREATE INDEX "clinical_alerts_org_id_idx" ON "clinical_alerts"("org_id");

ALTER TABLE "clinical_alerts"
ADD CONSTRAINT "clinical_alerts_org_id_fkey"
FOREIGN KEY ("org_id") REFERENCES "organizations"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
