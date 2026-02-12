/*
  Warnings:

  - You are about to drop the column `preferredPickupDate` on the `Claim` table. All the data in the column will be lost.
  - You are about to drop the `PickupStation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT "Claim_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "FoundDocumentCase" DROP CONSTRAINT "FoundDocumentCase_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "Handover" DROP CONSTRAINT "Handover_pickupStationId_fkey";

-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "country" SET DEFAULT 'KE';

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "preferredPickupDate",
ADD COLUMN     "preferredRecoveryDate" TIMESTAMP(3);

-- DropTable
DROP TABLE "PickupStation";

-- CreateTable
CREATE TABLE "pickup_stations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'KE',
    "postalCode" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "landmark" TEXT,
    "level1" TEXT NOT NULL,
    "level2" TEXT,
    "level3" TEXT,
    "level4" TEXT,
    "level5" TEXT,
    "coordinates" JSONB,
    "phoneNumber" TEXT,
    "email" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "operatingHours" JSONB NOT NULL,

    CONSTRAINT "pickup_stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pickup_stations_code_key" ON "pickup_stations"("code");

-- CreateIndex
CREATE INDEX "pickup_stations_code_idx" ON "pickup_stations"("code");

-- AddForeignKey
ALTER TABLE "FoundDocumentCase" ADD CONSTRAINT "FoundDocumentCase_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
