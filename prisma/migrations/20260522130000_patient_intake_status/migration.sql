-- Patient intake and status workflow fields
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "primary_diagnosis_icd10" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "admission_source" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "preferred_language" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "discharge_reason" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "discharge_disposition" TEXT;
