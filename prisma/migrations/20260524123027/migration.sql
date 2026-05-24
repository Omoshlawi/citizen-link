/*
  Warnings:

  - You are about to drop the column `extraction_result` on the `ai_extractions` table. All the data in the column will be lost.
  - You are about to drop the column `failure_reason` on the `ai_extractions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ai_extractions" DROP COLUMN "extraction_result",
DROP COLUMN "failure_reason",
ADD COLUMN     "extractionResult" JSONB,
ADD COLUMN     "failureReason" TEXT;
