-- Add the unified flag
ALTER TABLE "document_operation_types" ADD COLUMN "requiresCounterpartStation" BOOLEAN NOT NULL DEFAULT false;

-- Coalesce the two mutually-exclusive flags into the new column
UPDATE "document_operation_types"
SET "requiresCounterpartStation" = ("requiresDestinationStation" OR "requiresSourceStation");

-- Drop the old flags
ALTER TABLE "document_operation_types"
DROP COLUMN "requiresDestinationStation",
DROP COLUMN "requiresSourceStation";
