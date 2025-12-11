/*
  Warnings:

  - Made the column `extractionId` on table `FoundDocumentCase` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "FoundDocumentCase" DROP CONSTRAINT "FoundDocumentCase_extractionId_fkey";

-- AlterTable
ALTER TABLE "FoundDocumentCase" ALTER COLUMN "extractionId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "FoundDocumentCase" ADD CONSTRAINT "FoundDocumentCase_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "AIExtraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
