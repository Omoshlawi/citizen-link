-- AlterTable
ALTER TABLE "ai_extractions" ADD COLUMN "failure_reason" TEXT;
ALTER TABLE "ai_extractions" ADD COLUMN "extraction_result" JSONB;
