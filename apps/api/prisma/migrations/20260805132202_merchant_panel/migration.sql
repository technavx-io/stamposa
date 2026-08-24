-- AlterEnum
ALTER TYPE "StampIssuerType" ADD VALUE 'ADJUSTMENT';

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "brand_color" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "consent_text" TEXT,
ADD COLUMN     "consent_text_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "notify_daily_summary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_staff_inactive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_weekly_digest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "daily_stamp_cap" INTEGER,
ADD COLUMN     "terms" TEXT;

-- AlterTable
ALTER TABLE "customer_memberships" ADD COLUMN     "blocked_at" TIMESTAMP(3),
ADD COLUMN     "blocked_reason" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "stamps" ADD COLUMN     "delta" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "text" TEXT NOT NULL,
    "text_version" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consents_customer_id_business_id_created_at_idx" ON "consents"("customer_id", "business_id", "created_at");

-- CreateIndex
CREATE INDEX "consents_business_id_created_at_idx" ON "consents"("business_id", "created_at");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
