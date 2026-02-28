/*
  Warnings:

  - The values [DATA_EXTRACTION,CONFIDENCE_SCORE,IMAGE_ANALYSIS,SECURITY_QUESTIONS] on the enum `AIExtractionInteractionType` will be removed. If these variants are still used in the database, this will fail.
  - The values [DATA_EXTRACTION,CONFIDENCE_SCORE,IMAGE_ANALYSIS,ALTERNATIVE_MATCHES] on the enum `AIInteractionType` will be removed. If these variants are still used in the database, this will fail.
  - The values [EXPIRED] on the enum `MatchStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `finderReward` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `serviceFee` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `claimId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `finderReward` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `platformFee` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `refundedAt` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `serviceFee` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `disputes` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[caseNumber]` on the table `document_cases` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `document_types` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `caseNumber` to the `document_cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `document_types` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `invoiceId` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "AIExtractionInteractionType_new" AS ENUM ('VISION_EXTRACTION', 'TEXT_EXTRACTION');
ALTER TABLE "ai_extraction_interactions" ALTER COLUMN "extractionType" TYPE "AIExtractionInteractionType_new" USING ("extractionType"::text::"AIExtractionInteractionType_new");
ALTER TYPE "AIExtractionInteractionType" RENAME TO "AIExtractionInteractionType_old";
ALTER TYPE "AIExtractionInteractionType_new" RENAME TO "AIExtractionInteractionType";
DROP TYPE "public"."AIExtractionInteractionType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "AIInteractionType_new" AS ENUM ('VISION_EXTRACTION', 'TEXT_EXTRACTION', 'DOCUMENT_MATCHING', 'CLAIM_VERIFICATION', 'SECURITY_QUESTIONS_GEN', 'DISPUTE_ANALYSIS', 'USER_QUERY_RESPONSE');
ALTER TABLE "ai_interactions" ALTER COLUMN "interactionType" TYPE "AIInteractionType_new" USING ("interactionType"::text::"AIInteractionType_new");
ALTER TYPE "AIInteractionType" RENAME TO "AIInteractionType_old";
ALTER TYPE "AIInteractionType_new" RENAME TO "AIInteractionType";
DROP TYPE "public"."AIInteractionType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'UNDER_REVIEW';

-- AlterEnum
BEGIN;
CREATE TYPE "MatchStatus_new" AS ENUM ('PENDING', 'REJECTED', 'CLAIMED');
ALTER TABLE "public"."matches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "matches" ALTER COLUMN "status" TYPE "MatchStatus_new" USING ("status"::text::"MatchStatus_new");
ALTER TYPE "MatchStatus" RENAME TO "MatchStatus_old";
ALTER TYPE "MatchStatus_new" RENAME TO "MatchStatus";
DROP TYPE "public"."MatchStatus_old";
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_matchId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_claimId_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_initiatedBy_fkey";

-- DropForeignKey
ALTER TABLE "pickup_stations" DROP CONSTRAINT "pickup_stations_addressLocaleCode_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_claimId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- DropIndex
DROP INDEX "document_embedding_idx";

-- DropIndex
DROP INDEX "transactions_claimId_idx";

-- DropIndex
DROP INDEX "transactions_claimId_key";

-- AlterTable
ALTER TABLE "ai_interactions" ADD COLUMN     "parseError" JSONB,
ADD COLUMN     "parsedResponse" JSONB;

-- AlterTable
ALTER TABLE "claims" DROP COLUMN "finderReward",
DROP COLUMN "serviceFee",
DROP COLUMN "totalAmount",
ADD COLUMN     "pickupAddressId" TEXT,
ALTER COLUMN "claimNumber" DROP DEFAULT,
ALTER COLUMN "claimNumber" SET DATA TYPE TEXT;
DROP SEQUENCE "claims_claimNumber_seq";

-- AlterTable
ALTER TABLE "document_cases" ADD COLUMN     "caseNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "document_types" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "finderReward" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "serviceFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "addressComponents" JSONB,
ADD COLUMN     "addressCountry" TEXT,
ADD COLUMN     "addressRaw" TEXT,
ADD COLUMN     "fingerprintPresent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "givenNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isExpired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoPresent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signaturePresent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "surname" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "matches" ALTER COLUMN "matchNumber" DROP DEFAULT,
ALTER COLUMN "matchNumber" SET DATA TYPE TEXT;
DROP SEQUENCE "matches_matchNumber_seq";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "claimId",
DROP COLUMN "finderReward",
DROP COLUMN "paidAt",
DROP COLUMN "platformFee",
DROP COLUMN "refundedAt",
DROP COLUMN "serviceFee",
DROP COLUMN "totalAmount",
ADD COLUMN     "amount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "invoiceId" TEXT NOT NULL;

-- DropTable
DROP TABLE "disputes";

-- DropEnum
DROP TYPE "DisputeStatus";

-- DropEnum
DROP TYPE "DisputeType";

-- CreateTable
CREATE TABLE "entity_sequences" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transition_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT '*',
    "fromStatus" TEXT NOT NULL DEFAULT '*',
    "toStatus" TEXT NOT NULL DEFAULT '*',
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transition_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_transitions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reasonId" TEXT,
    "comment" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "serviceFee" DECIMAL(10,2) NOT NULL,
    "finderReward" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "balanceDue" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entity_sequences_prefix_key" ON "entity_sequences"("prefix");

-- CreateIndex
CREATE INDEX "transition_reasons_entityType_idx" ON "transition_reasons"("entityType");

-- CreateIndex
CREATE INDEX "transition_reasons_entityType_fromStatus_toStatus_idx" ON "transition_reasons"("entityType", "fromStatus", "toStatus");

-- CreateIndex
CREATE INDEX "transition_reasons_toStatus_idx" ON "transition_reasons"("toStatus");

-- CreateIndex
CREATE UNIQUE INDEX "transition_reasons_entityType_fromStatus_toStatus_code_key" ON "transition_reasons"("entityType", "fromStatus", "toStatus", "code");

-- CreateIndex
CREATE INDEX "status_transitions_entityId_entityType_idx" ON "status_transitions"("entityId", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_claimId_key" ON "invoices"("claimId");

-- CreateIndex
CREATE INDEX "invoices_claimId_idx" ON "invoices"("claimId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "document_cases_caseNumber_key" ON "document_cases"("caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_code_key" ON "document_types"("code");

-- CreateIndex
CREATE INDEX "transactions_invoiceId_idx" ON "transactions"("invoiceId");

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "transition_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_stations" ADD CONSTRAINT "pickup_stations_addressLocaleCode_fkey" FOREIGN KEY ("addressLocaleCode") REFERENCES "address_locales"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
