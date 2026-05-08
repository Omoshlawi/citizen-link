/*
  Warnings:

  - You are about to drop the column `requiresDestinationStation` on the `document_operation_types` table. All the data in the column will be lost.
  - You are about to drop the column `requiresSourceStation` on the `document_operation_types` table. All the data in the column will be lost.
  - You are about to drop the column `fromStationId` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `requestedByStationId` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `toStationId` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `collectionAddressId` on the `found_document_cases` table. All the data in the column will be lost.
  - You are about to drop the column `pickupStationId` on the `found_document_cases` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledPickupAt` on the `found_document_cases` table. All the data in the column will be lost.
  - You are about to drop the column `submissionMethod` on the `found_document_cases` table. All the data in the column will be lost.
  - You are about to drop the `document_collections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `handover_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `handovers` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ExchangeDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ExchangeMethod" AS ENUM ('STATION_DROPOFF', 'AGENT_PICKUP', 'OWNER_PICKUP', 'INHOUSE_DELIVERY', 'COURIER_DELIVERY');

-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "document_collections" DROP CONSTRAINT "document_collections_cancelledById_fkey";

-- DropForeignKey
ALTER TABLE "document_collections" DROP CONSTRAINT "document_collections_confirmedById_fkey";

-- DropForeignKey
ALTER TABLE "document_collections" DROP CONSTRAINT "document_collections_foundCaseId_fkey";

-- DropForeignKey
ALTER TABLE "document_collections" DROP CONSTRAINT "document_collections_initiatedById_fkey";

-- DropForeignKey
ALTER TABLE "document_operation_items" DROP CONSTRAINT "document_operation_items_foundCaseId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_createdById_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_fromStationId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_operationTypeId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_requestedByStationId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_toStationId_fkey";

-- DropForeignKey
ALTER TABLE "found_document_cases" DROP CONSTRAINT "found_document_cases_collectionAddressId_fkey";

-- DropForeignKey
ALTER TABLE "found_document_cases" DROP CONSTRAINT "found_document_cases_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "handover_events" DROP CONSTRAINT "handover_events_handoverId_fkey";

-- DropForeignKey
ALTER TABLE "handovers" DROP CONSTRAINT "handovers_claimId_fkey";

-- DropForeignKey
ALTER TABLE "handovers" DROP CONSTRAINT "handovers_deliveryAddressId_fkey";

-- DropForeignKey
ALTER TABLE "handovers" DROP CONSTRAINT "handovers_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "staff_station_operations" DROP CONSTRAINT "staff_station_operations_grantedById_fkey";

-- DropIndex
DROP INDEX "document_embedding_1536_idx";

-- DropIndex
DROP INDEX "document_embedding_768_idx";

-- AlterTable
ALTER TABLE "document_operation_items" ADD COLUMN     "userAddressId" TEXT;

-- AlterTable
ALTER TABLE "document_operation_types" DROP COLUMN "requiresDestinationStation",
DROP COLUMN "requiresSourceStation",
ADD COLUMN     "requiresCounterpartStation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresItemAddresses" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresTargetArea" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "document_operations" DROP COLUMN "fromStationId",
DROP COLUMN "requestedByStationId",
DROP COLUMN "toStationId",
ADD COLUMN     "counterpartStationId" TEXT,
ADD COLUMN     "responsiblePersonId" TEXT,
ADD COLUMN     "targetArea" TEXT;

-- AlterTable
ALTER TABLE "found_document_cases" DROP COLUMN "collectionAddressId",
DROP COLUMN "pickupStationId",
DROP COLUMN "scheduledPickupAt",
DROP COLUMN "submissionMethod";

-- DropTable
DROP TABLE "document_collections";

-- DropTable
DROP TABLE "handover_events";

-- DropTable
DROP TABLE "handovers";

-- DropEnum
DROP TYPE "DocumentCollectionStatus";

-- DropEnum
DROP TYPE "HandoverMethod";

-- DropEnum
DROP TYPE "HandoverStatus";

-- DropEnum
DROP TYPE "SubmissionMethod";

-- CreateTable
CREATE TABLE "document_exchanges" (
    "id" TEXT NOT NULL,
    "exchangeNumber" TEXT NOT NULL,
    "direction" "ExchangeDirection" NOT NULL,
    "method" "ExchangeMethod" NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'SCHEDULED',
    "foundCaseId" TEXT,
    "claimId" TEXT,
    "stationId" TEXT,
    "addressId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "courierProvider" TEXT,
    "trackingNumber" TEXT,
    "externalShipmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "completedById" TEXT,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_verifications" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "issuedById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_events" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "handledById" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_exchanges_exchangeNumber_key" ON "document_exchanges"("exchangeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "document_exchanges_claimId_key" ON "document_exchanges"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "document_exchanges_trackingNumber_key" ON "document_exchanges"("trackingNumber");

-- CreateIndex
CREATE INDEX "document_exchanges_foundCaseId_status_idx" ON "document_exchanges"("foundCaseId", "status");

-- CreateIndex
CREATE INDEX "document_exchanges_trackingNumber_idx" ON "document_exchanges"("trackingNumber");

-- CreateIndex
CREATE INDEX "exchange_verifications_exchangeId_status_idx" ON "exchange_verifications"("exchangeId", "status");

-- CreateIndex
CREATE INDEX "exchange_events_exchangeId_idx" ON "exchange_events"("exchangeId");

-- CreateIndex
CREATE INDEX "addresses_level3_idx" ON "addresses"("level3");

-- AddForeignKey
ALTER TABLE "document_exchanges" ADD CONSTRAINT "document_exchanges_foundCaseId_fkey" FOREIGN KEY ("foundCaseId") REFERENCES "found_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_exchanges" ADD CONSTRAINT "document_exchanges_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_exchanges" ADD CONSTRAINT "document_exchanges_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_exchanges" ADD CONSTRAINT "document_exchanges_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_exchanges" ADD CONSTRAINT "document_exchanges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_exchanges" ADD CONSTRAINT "document_exchanges_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_exchanges" ADD CONSTRAINT "document_exchanges_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_verifications" ADD CONSTRAINT "exchange_verifications_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "document_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_verifications" ADD CONSTRAINT "exchange_verifications_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_verifications" ADD CONSTRAINT "exchange_verifications_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_verifications" ADD CONSTRAINT "exchange_verifications_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_events" ADD CONSTRAINT "exchange_events_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "document_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_station_operations" ADD CONSTRAINT "staff_station_operations_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "document_operation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_counterpartStationId_fkey" FOREIGN KEY ("counterpartStationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operation_items" ADD CONSTRAINT "document_operation_items_foundCaseId_fkey" FOREIGN KEY ("foundCaseId") REFERENCES "found_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operation_items" ADD CONSTRAINT "document_operation_items_userAddressId_fkey" FOREIGN KEY ("userAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
