-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "email" TEXT,
ADD COLUMN     "password_hash" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "email" TEXT,
ADD COLUMN     "password_hash" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "merchants_email_key" ON "merchants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

