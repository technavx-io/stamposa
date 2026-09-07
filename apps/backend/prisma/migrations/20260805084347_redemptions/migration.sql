-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('PENDING', 'REDEEMED');

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "reward_text" TEXT NOT NULL,
    "earned_by_stamp_id" TEXT,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "redeemed_at" TIMESTAMP(3),
    "redeemed_by_type" "StampIssuerType",
    "redeemed_staff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_code_key" ON "redemptions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "redemptions_earned_by_stamp_id_key" ON "redemptions"("earned_by_stamp_id");

-- CreateIndex
CREATE INDEX "redemptions_business_id_status_created_at_idx" ON "redemptions"("business_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "redemptions_membership_id_status_idx" ON "redemptions"("membership_id", "status");

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "customer_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_earned_by_stamp_id_fkey" FOREIGN KEY ("earned_by_stamp_id") REFERENCES "stamps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_redeemed_staff_id_fkey" FOREIGN KEY ("redeemed_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
