/*
  Warnings:

  - Made the column `foundCaseId` on table `document_exchanges` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "document_exchanges_claimId_key";

-- Backfill foundCaseId on OUTBOUND exchanges from claim→match
UPDATE document_exchanges de
SET "foundCaseId" = m."foundDocumentCaseId"
FROM claims c
JOIN matches m ON m.id = c."matchId"
WHERE de."claimId" = c.id
  AND de."foundCaseId" IS NULL;

-- AlterTable
ALTER TABLE "document_exchanges" ALTER COLUMN "foundCaseId" SET NOT NULL;
