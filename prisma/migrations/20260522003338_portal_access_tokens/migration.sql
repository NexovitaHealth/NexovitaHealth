-- CreateEnum
CREATE TYPE "PortalSubjectType" AS ENUM ('patient', 'family_caregiver');

-- CreateTable
CREATE TABLE "portal_access_tokens" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "subject_type" "PortalSubjectType" NOT NULL,
    "family_caregiver_account_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_access_tokens_token_hash_key" ON "portal_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "portal_access_tokens_org_id_idx" ON "portal_access_tokens"("org_id");

-- CreateIndex
CREATE INDEX "portal_access_tokens_patient_id_idx" ON "portal_access_tokens"("patient_id");

-- CreateIndex
CREATE INDEX "portal_access_tokens_family_caregiver_account_id_idx" ON "portal_access_tokens"("family_caregiver_account_id");

-- CreateIndex
CREATE INDEX "portal_access_tokens_expires_at_idx" ON "portal_access_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_family_caregiver_account_id_fkey" FOREIGN KEY ("family_caregiver_account_id") REFERENCES "family_caregiver_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
