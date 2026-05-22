-- Migration: change current_step from ExtractionStep enum to plain TEXT
-- Rationale: adding new pipeline steps (STRUCTURE, POST_PROCESS, etc.) would
-- otherwise require a DB migration just to extend the enum. String column +
-- application-level validation is cheaper and more future-proof.

-- 1. Cast the existing enum column to text
ALTER TABLE "ai_extractions"
  ALTER COLUMN "current_step" TYPE TEXT
  USING "current_step"::TEXT;

-- 2. Drop the now-unused enum type
DROP TYPE IF EXISTS "ExtractionStep";
