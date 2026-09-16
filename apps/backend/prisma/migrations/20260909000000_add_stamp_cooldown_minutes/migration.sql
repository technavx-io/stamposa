-- Bug #10: merchant-set minutes between stamps for the SAME customer on a
-- campaign. Nullable so older campaigns keep their existing behaviour
-- (only the 3-second double-tap guard) until the merchant edits them.
ALTER TABLE "campaigns" ADD COLUMN "stamp_cooldown_minutes" INTEGER;
