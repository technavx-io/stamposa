-- Feedback: cross-role product feedback surfaced in the admin panel.
-- CreateEnum
CREATE TYPE "FeedbackAuthorType" AS ENUM ('MERCHANT', 'STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'SUGGESTION', 'PRAISE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'RESOLVED');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "author_type" "FeedbackAuthorType" NOT NULL,
    "author_id" TEXT,
    "author_label" TEXT NOT NULL,
    "business_id" TEXT,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'OTHER',
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_created_at_idx" ON "feedback"("created_at");

-- CreateIndex
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_author_type_created_at_idx" ON "feedback"("author_type", "created_at");

-- CreateIndex
CREATE INDEX "feedback_business_id_created_at_idx" ON "feedback"("business_id", "created_at");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

