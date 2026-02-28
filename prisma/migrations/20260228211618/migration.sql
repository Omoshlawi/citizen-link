/*
  Warnings:

  - You are about to drop the column `extractionData` on the `ai_extraction_interactions` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `ai_interactions` table. All the data in the column will be lost.
  - You are about to drop the column `success` on the `ai_interactions` table. All the data in the column will be lost.
  - You are about to drop the column `securityQuestion` on the `found_document_cases` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ai_interactions_success_idx";

-- AlterTable
ALTER TABLE "ai_extraction_interactions" DROP COLUMN "extractionData",
ADD COLUMN     "confidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ai_extractions" ADD COLUMN     "documentTypeCode" TEXT,
ADD COLUMN     "extractionConfidence" DOUBLE PRECISION,
ADD COLUMN     "fallbackTriggered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ocrConfidence" DOUBLE PRECISION,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warnings" JSONB;

-- AlterTable
ALTER TABLE "ai_interactions" DROP COLUMN "errorMessage",
DROP COLUMN "success",
ADD COLUMN     "callError" TEXT,
ADD COLUMN     "callSuccess" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parseSuccess" BOOLEAN;

-- AlterTable
ALTER TABLE "found_document_cases" DROP COLUMN "securityQuestion";

-- CreateIndex
CREATE INDEX "ai_interactions_callSuccess_idx" ON "ai_interactions"("callSuccess");

-- CreateIndex
CREATE INDEX "ai_interactions_parseSuccess_idx" ON "ai_interactions"("parseSuccess");
