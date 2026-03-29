/*
  Warnings:

  - You are about to drop the column `pickupAddressId` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `pickupStationId` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `preferredHandoverDate` on the `claims` table. All the data in the column will be lost.
  - Added the required column `method` to the `handovers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "HandoverMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_pickupAddressId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "handovers" DROP CONSTRAINT "handovers_pickupStationId_fkey";

-- AlterTable
ALTER TABLE "claims" DROP COLUMN "pickupAddressId",
DROP COLUMN "pickupStationId",
DROP COLUMN "preferredHandoverDate";

-- AlterTable
ALTER TABLE "handovers" ADD COLUMN     "deliveryAddressId" TEXT,
ADD COLUMN     "method" "HandoverMethod" NOT NULL,
ALTER COLUMN "pickupStationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
