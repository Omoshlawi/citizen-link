/*
  Warnings:

  - Added the required column `addressLocaleCode` to the `pickup_stations` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "pickup_stations_code_idx";

-- AlterTable
ALTER TABLE "pickup_stations" ADD COLUMN     "addressLocaleCode" TEXT NOT NULL,
ALTER COLUMN "operatingHours" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "pickup_stations" ADD CONSTRAINT "pickup_stations_addressLocaleCode_fkey" FOREIGN KEY ("addressLocaleCode") REFERENCES "AddressLocale"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
