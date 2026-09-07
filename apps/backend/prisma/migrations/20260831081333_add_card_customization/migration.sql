-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "card_image_path" TEXT,
ADD COLUMN     "reward_icon" TEXT,
ADD COLUMN     "stamp_icon" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "card_color" TEXT,
ADD COLUMN     "card_image_path" TEXT,
ADD COLUMN     "reward_icon" TEXT,
ADD COLUMN     "stamp_icon" TEXT;
