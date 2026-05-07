/*
  Warnings:

  - You are about to drop the column `fromStationId` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `requestedByStationId` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `toStationId` on the `document_operations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_fromStationId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_requestedByStationId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_toStationId_fkey";

-- AlterTable
ALTER TABLE "document_operations" DROP COLUMN "fromStationId",
DROP COLUMN "requestedByStationId",
DROP COLUMN "toStationId",
ADD COLUMN     "counterpartStationId" TEXT;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_counterpartStationId_fkey" FOREIGN KEY ("counterpartStationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
