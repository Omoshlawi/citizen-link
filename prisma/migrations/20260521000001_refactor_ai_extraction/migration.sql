-- Allow multiple extractions per case (retries)
ALTER TABLE "ai_extractions" DROP CONSTRAINT IF EXISTS "ai_extractions_caseId_key";
CREATE INDEX IF NOT EXISTS "ai_extractions_caseId_idx" ON "ai_extractions"("caseId");

-- Remove columns that are now docai's responsibility
ALTER TABLE "ai_extractions" DROP COLUMN IF EXISTS "fallbackTriggered";

-- Drop step interaction tables — docai owns the pipeline audit trail now
DROP TABLE IF EXISTS "ai_extraction_interactions";

-- Drop unused enum types (PostgreSQL requires explicit drops)
DROP TYPE IF EXISTS "AIExtractionInteractionType";

-- Trim ExtractionStep enum — only VISION is used (docai webhook progress signal)
-- PostgreSQL doesn't support DROP VALUE, so rename the type and recreate
ALTER TYPE "ExtractionStep" RENAME TO "ExtractionStep_old";
CREATE TYPE "ExtractionStep" AS ENUM ('VISION');
ALTER TABLE "ai_extractions"
  ALTER COLUMN "currentStep" TYPE "ExtractionStep"
  USING CASE "currentStep"::text
    WHEN 'VISION' THEN 'VISION'::"ExtractionStep"
    ELSE NULL
  END;
DROP TYPE "ExtractionStep_old";
