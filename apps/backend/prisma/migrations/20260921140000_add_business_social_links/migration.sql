-- Social-media links for the /b/<slug> Menu & info page.
-- Merchants fill in whichever platforms they use; the public page renders
-- a "Follow us" icon row and hides platforms left blank. All optional so
-- existing businesses keep working unchanged.
-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "instagram_url" VARCHAR(500),
ADD COLUMN "facebook_url" VARCHAR(500),
ADD COLUMN "youtube_url" VARCHAR(500),
ADD COLUMN "x_url" VARCHAR(500),
ADD COLUMN "linkedin_url" VARCHAR(500),
ADD COLUMN "tiktok_url" VARCHAR(500),
ADD COLUMN "whatsapp_url" VARCHAR(500);
