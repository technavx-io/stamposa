-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('STAFF', 'MANAGER');

-- AlterEnum
ALTER TYPE "RedemptionStatus" ADD VALUE 'VOID';

-- AlterTable
ALTER TABLE "redemptions" ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "role" "StaffRole" NOT NULL DEFAULT 'STAFF';

-- AlterTable
ALTER TABLE "stamps" ADD COLUMN     "undone_at" TIMESTAMP(3),
ADD COLUMN     "undone_by_staff_id" TEXT;

-- AddForeignKey
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_undone_by_staff_id_fkey" FOREIGN KEY ("undone_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
