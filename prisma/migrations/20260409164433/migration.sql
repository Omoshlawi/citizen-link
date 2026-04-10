/*
  Warnings:

  - The values [IN_PROGRESS] on the enum `HandoverStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `success` on the `ai_extractions` table. All the data in the column will be lost.
  - You are about to drop the column `pickupAddressId` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `pickupStationId` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `preferredHandoverDate` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `extractionId` on the `document_cases` table. All the data in the column will be lost.
  - You are about to drop the column `finderPresent` on the `handovers` table. All the data in the column will be lost.
  - You are about to drop the column `finderSignature` on the `handovers` table. All the data in the column will be lost.
  - You are about to drop the column `handoverNotes` on the `handovers` table. All the data in the column will be lost.
  - You are about to drop the column `ownerSignature` on the `handovers` table. All the data in the column will be lost.
  - You are about to drop the column `ownerVerified` on the `handovers` table. All the data in the column will be lost.
  - You are about to drop the column `aiInteractionId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `aiScore` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `aiVerificationResult` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `securityQuestions` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `securityQuestionsAiInteractionId` on the `matches` table. All the data in the column will be lost.
  - The `paymentProvider` column on the `transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `case_status_transitions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[caseId]` on the table `ai_extractions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[trackingNumber]` on the table `handovers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[key,userId]` on the table `settings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[checkoutRequestId]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `caseId` to the `ai_extractions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `handovers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `auto` to the `lost_document_cases` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionStep" AS ENUM ('VISION', 'TEXT', 'POST_PROCESSING');

-- CreateEnum
CREATE TYPE "DocumentCollectionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionMethod" AS ENUM ('DROPOFF', 'PICKUP');

-- CreateEnum
CREATE TYPE "HandoverMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "CustodyStatus" AS ENUM ('WITH_FINDER', 'IN_CUSTODY', 'IN_TRANSIT', 'HANDED_OVER', 'DISPOSED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MPESA', 'STRIPE', 'AFRICASTALKING');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'INITIATED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletEntryReason" AS ENUM ('FINDER_REWARD', 'WITHDRAWAL', 'WITHDRAWAL_REVERSAL', 'REFUND');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- AlterEnum
BEGIN;
CREATE TYPE "HandoverStatus_new" AS ENUM ('SCHEDULED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'FAILED', 'NO_SHOW', 'CANCELLED');
ALTER TABLE "public"."handovers" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "handovers" ALTER COLUMN "status" TYPE "HandoverStatus_new" USING ("status"::text::"HandoverStatus_new");
ALTER TYPE "HandoverStatus" RENAME TO "HandoverStatus_old";
ALTER TYPE "HandoverStatus_new" RENAME TO "HandoverStatus";
DROP TYPE "public"."HandoverStatus_old";
ALTER TABLE "handovers" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'OVERDUE';

-- DropForeignKey
ALTER TABLE "case_status_transitions" DROP CONSTRAINT "case_status_transitions_caseId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_pickupAddressId_fkey";

-- DropForeignKey
ALTER TABLE "claims" DROP CONSTRAINT "claims_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "document_cases" DROP CONSTRAINT "document_cases_extractionId_fkey";

-- DropForeignKey
ALTER TABLE "handovers" DROP CONSTRAINT "handovers_pickupStationId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_claimId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_aiInteractionId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_securityQuestionsAiInteractionId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_documentCaseId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- DropIndex
DROP INDEX "document_embedding_ada_idx";

-- DropIndex
DROP INDEX "document_embedding_idx";

-- DropIndex
DROP INDEX "handovers_claimId_idx";

-- DropIndex
DROP INDEX "handovers_status_idx";

-- DropIndex
DROP INDEX "matches_aiInteractionId_key";

-- DropIndex
DROP INDEX "matches_securityQuestionsAiInteractionId_key";

-- DropIndex
DROP INDEX "settings_key_key";

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phoneNumber" TEXT;

-- AlterTable
ALTER TABLE "ai_extractions" DROP COLUMN "success",
ADD COLUMN     "caseId" TEXT NOT NULL,
ADD COLUMN     "currentStep" "ExtractionStep",
ADD COLUMN     "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "claims" DROP COLUMN "pickupAddressId",
DROP COLUMN "pickupStationId",
DROP COLUMN "preferredHandoverDate";

-- AlterTable
ALTER TABLE "document_cases" DROP COLUMN "extractionId";

-- AlterTable
ALTER TABLE "found_document_cases" ADD COLUMN     "collectionAddressId" TEXT,
ADD COLUMN     "currentStationId" TEXT,
ADD COLUMN     "custodyStatus" "CustodyStatus" NOT NULL DEFAULT 'WITH_FINDER',
ADD COLUMN     "scheduledPickupAt" TIMESTAMP(3),
ADD COLUMN     "submissionMethod" "SubmissionMethod";

-- AlterTable
ALTER TABLE "handovers" DROP COLUMN "finderPresent",
DROP COLUMN "finderSignature",
DROP COLUMN "handoverNotes",
DROP COLUMN "ownerSignature",
DROP COLUMN "ownerVerified",
ADD COLUMN     "courierProvider" TEXT,
ADD COLUMN     "deliveryAddressId" TEXT,
ADD COLUMN     "externalShipmentId" TEXT,
ADD COLUMN     "method" "HandoverMethod" NOT NULL,
ADD COLUMN     "trackingNumber" TEXT,
ALTER COLUMN "pickupStationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lost_document_cases" ADD COLUMN     "auto" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "aiInteractionId",
DROP COLUMN "aiScore",
DROP COLUMN "aiVerificationResult",
DROP COLUMN "securityQuestions",
DROP COLUMN "securityQuestionsAiInteractionId";

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT '*';

-- AlterTable
ALTER TABLE "status_transitions" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "checkoutRequestId" TEXT,
ADD COLUMN     "initiatedById" TEXT,
DROP COLUMN "paymentProvider",
ADD COLUMN     "paymentProvider" "PaymentProvider";

-- DropTable
DROP TABLE "case_status_transitions";

-- DropTable
DROP TABLE "notifications";

-- DropEnum
DROP TYPE "ActorType";

-- DropEnum
DROP TYPE "CaseType";

-- CreateTable
CREATE TABLE "document_collections" (
    "id" TEXT NOT NULL,
    "foundCaseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "DocumentCollectionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "initiatedById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_events" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "handledByType" TEXT,
    "handledById" TEXT,
    "status" "HandoverStatus" NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationName" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" TEXT NOT NULL,
    "disbursementNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentProvider" "PaymentProvider",
    "providerTransactionId" TEXT,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "initiatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "reason" "WalletEntryReason" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "balanceBefore" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "engine" TEXT NOT NULL DEFAULT 'handlebars',
    "slots" JSONB NOT NULL,
    "schema" JSONB,
    "metadata" JSONB,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "slots" JSONB NOT NULL,
    "schema" JSONB,
    "metadata" JSONB,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "description" TEXT,
    "readAt" TIMESTAMP(3),
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "templateId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "recipientId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "metadata" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'expo',
    "deviceName" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_operation_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requiresDestinationStation" BOOLEAN NOT NULL DEFAULT false,
    "requiresSourceStation" BOOLEAN NOT NULL DEFAULT false,
    "requiresNotes" BOOLEAN NOT NULL DEFAULT false,
    "isHighPrivilege" BOOLEAN NOT NULL DEFAULT false,
    "isFinalOperation" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_operation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_operation_types" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "operationTypeId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_operation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_station_operations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "operationTypeId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_station_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_operations" (
    "id" TEXT NOT NULL,
    "operationNumber" TEXT NOT NULL,
    "foundCaseId" TEXT NOT NULL,
    "operationTypeId" TEXT NOT NULL,
    "stationId" TEXT,
    "fromStationId" TEXT,
    "toStationId" TEXT,
    "requestedByStationId" TEXT,
    "performedById" TEXT NOT NULL,
    "pairedOperationId" TEXT,
    "custodyStatusBefore" "CustodyStatus" NOT NULL,
    "custodyStatusAfter" "CustodyStatus" NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_collections_foundCaseId_status_idx" ON "document_collections"("foundCaseId", "status");

-- CreateIndex
CREATE INDEX "handover_events_handoverId_idx" ON "handover_events"("handoverId");

-- CreateIndex
CREATE UNIQUE INDEX "disbursements_disbursementNumber_key" ON "disbursements"("disbursementNumber");

-- CreateIndex
CREATE INDEX "disbursements_invoiceId_idx" ON "disbursements"("invoiceId");

-- CreateIndex
CREATE INDEX "disbursements_recipientId_idx" ON "disbursements"("recipientId");

-- CreateIndex
CREATE INDEX "disbursements_status_idx" ON "disbursements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallet_ledger_walletId_idx" ON "wallet_ledger"("walletId");

-- CreateIndex
CREATE INDEX "wallet_ledger_referenceType_referenceId_idx" ON "wallet_ledger"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "templates_key_key" ON "templates"("key");

-- CreateIndex
CREATE INDEX "template_versions_templateId_idx" ON "template_versions"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_templateId_version_key" ON "template_versions"("templateId", "version");

-- CreateIndex
CREATE INDEX "notification_events_userId_idx" ON "notification_events"("userId");

-- CreateIndex
CREATE INDEX "notification_events_createdAt_idx" ON "notification_events"("createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_eventId_idx" ON "notification_logs"("eventId");

-- CreateIndex
CREATE INDEX "notification_logs_recipientId_idx" ON "notification_logs"("recipientId");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "notification_logs_channel_idx" ON "notification_logs"("channel");

-- CreateIndex
CREATE INDEX "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_push_tokens_token_key" ON "user_push_tokens"("token");

-- CreateIndex
CREATE INDEX "user_push_tokens_userId_idx" ON "user_push_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "document_operation_types_code_key" ON "document_operation_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "document_operation_types_prefix_key" ON "document_operation_types"("prefix");

-- CreateIndex
CREATE INDEX "station_operation_types_stationId_idx" ON "station_operation_types"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "station_operation_types_stationId_operationTypeId_key" ON "station_operation_types"("stationId", "operationTypeId");

-- CreateIndex
CREATE INDEX "staff_station_operations_userId_stationId_idx" ON "staff_station_operations"("userId", "stationId");

-- CreateIndex
CREATE INDEX "staff_station_operations_stationId_idx" ON "staff_station_operations"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_station_operations_userId_stationId_operationTypeId_key" ON "staff_station_operations"("userId", "stationId", "operationTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "document_operations_operationNumber_key" ON "document_operations"("operationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "document_operations_pairedOperationId_key" ON "document_operations"("pairedOperationId");

-- CreateIndex
CREATE INDEX "document_operations_foundCaseId_idx" ON "document_operations"("foundCaseId");

-- CreateIndex
CREATE INDEX "document_operations_operationTypeId_idx" ON "document_operations"("operationTypeId");

-- CreateIndex
CREATE INDEX "document_operations_stationId_idx" ON "document_operations"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_extractions_caseId_key" ON "ai_extractions"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "handovers_trackingNumber_key" ON "handovers"("trackingNumber");

-- CreateIndex
CREATE INDEX "handovers_trackingNumber_idx" ON "handovers"("trackingNumber");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE INDEX "settings_userId_idx" ON "settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_userId_key" ON "settings"("key", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_checkoutRequestId_key" ON "transactions"("checkoutRequestId");

-- CreateIndex
CREATE INDEX "transactions_checkoutRequestId_idx" ON "transactions"("checkoutRequestId");

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_document_cases" ADD CONSTRAINT "found_document_cases_collectionAddressId_fkey" FOREIGN KEY ("collectionAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_document_cases" ADD CONSTRAINT "found_document_cases_currentStationId_fkey" FOREIGN KEY ("currentStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_foundCaseId_fkey" FOREIGN KEY ("foundCaseId") REFERENCES "found_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_events" ADD CONSTRAINT "handover_events_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "handovers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_push_tokens" ADD CONSTRAINT "user_push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_operation_types" ADD CONSTRAINT "station_operation_types_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "pickup_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_operation_types" ADD CONSTRAINT "station_operation_types_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "document_operation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_station_operations" ADD CONSTRAINT "staff_station_operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_station_operations" ADD CONSTRAINT "staff_station_operations_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "pickup_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_station_operations" ADD CONSTRAINT "staff_station_operations_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "document_operation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_station_operations" ADD CONSTRAINT "staff_station_operations_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_foundCaseId_fkey" FOREIGN KEY ("foundCaseId") REFERENCES "found_document_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "document_operation_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_fromStationId_fkey" FOREIGN KEY ("fromStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_toStationId_fkey" FOREIGN KEY ("toStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_requestedByStationId_fkey" FOREIGN KEY ("requestedByStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_pairedOperationId_fkey" FOREIGN KEY ("pairedOperationId") REFERENCES "document_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
