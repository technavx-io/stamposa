-- A customer is now identified by a phone number OR an email address.
--
-- Motivation: customer sign-in was phone+OTP only, which cannot work until
-- Indian DLT/SMS approval lands. Email-capable customers unblock launch.

-- Phone becomes optional...
ALTER TABLE "customers" ALTER COLUMN "phone" DROP NOT NULL;

-- ...and email joins it as an equally valid identity.
ALTER TABLE "customers" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- Exactly the invariant Prisma cannot express: optional individually,
-- mandatory together. Without this a customer row could carry no identity at
-- all and become unreachable — present in the ledger, impossible to sign in
-- as, impossible to erase on request.
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_identity_present"
  CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);
