-- Menu & info page — the public /b/<slug> digital business card.
-- Every field is optional; the merchant fills what they want to show.
-- AlterTable
-- Reuses the existing `address` and `phone` columns on `businesses` for the
-- Menu & Info page (both were already nullable text on the Business model),
-- so this only adds the six genuinely-new fields.
ALTER TABLE "businesses" ADD COLUMN "menu_url" VARCHAR(500),
ADD COLUMN "about_text" VARCHAR(500),
ADD COLUMN "website_url" VARCHAR(500),
ADD COLUMN "hours_text" VARCHAR(200),
ADD COLUMN "contact_email" VARCHAR(200),
ADD COLUMN "google_maps_url" VARCHAR(500);
