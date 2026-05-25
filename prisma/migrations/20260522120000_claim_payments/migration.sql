-- CreateTable
CREATE TABLE "claim_payments" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "recorded_by_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_reference" TEXT,
    "payment_method" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "claim_payments_org_id_idx" ON "claim_payments"("org_id");

-- CreateIndex
CREATE INDEX "claim_payments_claim_id_idx" ON "claim_payments"("claim_id");

-- CreateIndex
CREATE INDEX "claim_payments_paid_at_idx" ON "claim_payments"("paid_at");

-- AddForeignKey
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_payments" ADD CONSTRAINT "claim_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
