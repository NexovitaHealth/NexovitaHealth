-- CreateTable
CREATE TABLE "agency_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sent_by" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "org_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_invitations_token_key" ON "agency_invitations"("token");

-- CreateIndex
CREATE INDEX "agency_invitations_token_idx" ON "agency_invitations"("token");

-- CreateIndex
CREATE INDEX "agency_invitations_email_idx" ON "agency_invitations"("email");

-- AddForeignKey
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
