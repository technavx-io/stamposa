-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('ALL_PASS_HOLDERS');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "wallet_message" TEXT,
ADD COLUMN     "wallet_message_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL DEFAULT 'ALL_PASS_HOLDERS',
    "status" "BroadcastStatus" NOT NULL DEFAULT 'QUEUED',
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "apple_devices" INTEGER NOT NULL DEFAULT 0,
    "google_notified" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_business_id_created_at_idx" ON "broadcasts"("business_id", "created_at");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
