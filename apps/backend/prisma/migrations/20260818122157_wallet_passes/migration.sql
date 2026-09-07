-- CreateTable
CREATE TABLE "wallet_passes" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "apple_auth_token" TEXT NOT NULL,
    "apple_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "google_object_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apple_wallet_registrations" (
    "id" TEXT NOT NULL,
    "wallet_pass_id" TEXT NOT NULL,
    "device_library_id" TEXT NOT NULL,
    "push_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apple_wallet_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_passes_membership_id_key" ON "wallet_passes"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_passes_apple_auth_token_key" ON "wallet_passes"("apple_auth_token");

-- CreateIndex
CREATE INDEX "apple_wallet_registrations_device_library_id_idx" ON "apple_wallet_registrations"("device_library_id");

-- CreateIndex
CREATE UNIQUE INDEX "apple_wallet_registrations_device_library_id_wallet_pass_id_key" ON "apple_wallet_registrations"("device_library_id", "wallet_pass_id");

-- AddForeignKey
ALTER TABLE "wallet_passes" ADD CONSTRAINT "wallet_passes_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "customer_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apple_wallet_registrations" ADD CONSTRAINT "apple_wallet_registrations_wallet_pass_id_fkey" FOREIGN KEY ("wallet_pass_id") REFERENCES "wallet_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
