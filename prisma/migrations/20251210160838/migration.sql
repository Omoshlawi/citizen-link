/*
  Warnings:

  - You are about to drop the column `aiExtractedData` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `aiExtractionPrompt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `extractionConfidence` on the `Document` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "aiExtractedData",
DROP COLUMN "aiExtractionPrompt",
DROP COLUMN "extractionConfidence";
