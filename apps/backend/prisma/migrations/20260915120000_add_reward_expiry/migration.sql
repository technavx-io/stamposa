-- Add reward-expiry support (voucher lifecycle).
-- Campaign gets the merchant-tunable window (null = no expiry).
ALTER TABLE "campaigns" ADD COLUMN "reward_expiry_days" INTEGER;

-- Redemption gets the snapshotted expiry timestamp (null = never) and a new
-- terminal status EXPIRED for vouchers that reach expiresAt while PENDING.
ALTER TYPE "RedemptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TABLE "redemptions" ADD COLUMN "expires_at" TIMESTAMP(3);

-- Fast lookup for "which PENDING vouchers are past expiresAt?" — used both
-- by lazy-expiration in redeem() and by any future background sweep.
CREATE INDEX "redemptions_status_expires_at_idx" ON "redemptions"("status", "expires_at");
