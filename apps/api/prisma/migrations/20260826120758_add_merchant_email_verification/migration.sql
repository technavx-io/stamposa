-- Merchant email verification: unverified accounts cannot sign in until they
-- confirm the 6-digit code emailed at signup.

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- Grandfather every existing merchant as verified — they predate this check
-- and must not be locked out. New signups are created with NULL (unverified).
UPDATE "merchants" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL;
