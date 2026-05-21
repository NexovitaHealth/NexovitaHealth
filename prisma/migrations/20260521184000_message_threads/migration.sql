-- CreateTable
CREATE TABLE "message_threads" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "subject" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_thread_participants" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_thread_participants_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "thread_id" TEXT;

-- CreateIndex
CREATE INDEX "message_threads_org_id_idx" ON "message_threads"("org_id");

-- CreateIndex
CREATE INDEX "message_threads_patient_id_idx" ON "message_threads"("patient_id");

-- CreateIndex
CREATE INDEX "message_threads_deleted_at_idx" ON "message_threads"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_thread_participants_thread_id_user_id_key" ON "message_thread_participants"("thread_id", "user_id");

-- CreateIndex
CREATE INDEX "message_thread_participants_user_id_idx" ON "message_thread_participants"("user_id");

-- CreateIndex
CREATE INDEX "messages_thread_id_idx" ON "messages"("thread_id");

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
