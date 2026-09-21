-- Menu & info page — the public /b/<slug> digital business card.
-- Every field is optional; the merchant fills what they want to show.
-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "menu_url" VARCHAR(500),
ADD COLUMN "about_text" VARCHAR(500),
ADD COLUMN "address_line" VARCHAR(200),
ADD COLUMN "phone_number" VARCHAR(30),
ADD COLUMN "website_url" VARCHAR(500),
ADD COLUMN "hours_text" VARCHAR(200),
ADD COLUMN "contact_email" VARCHAR(200),
ADD COLUMN "google_maps_url" VARCHAR(500);
