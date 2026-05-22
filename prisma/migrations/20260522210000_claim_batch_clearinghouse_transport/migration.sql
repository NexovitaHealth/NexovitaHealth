-- CreateEnum
CREATE TYPE "ClaimBatchTransportStatus" AS ENUM ('file_only', 'pending', 'transmitted', 'failed');

-- AlterTable
ALTER TABLE "claim_submission_batches" ADD COLUMN     "transport_mode" TEXT,
ADD COLUMN     "transport_status" "ClaimBatchTransportStatus" DEFAULT 'file_only',
ADD COLUMN     "transport_message" TEXT,
ADD COLUMN     "transmitted_at" TIMESTAMP(3);
