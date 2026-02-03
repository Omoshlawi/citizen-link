/*
  Warnings:

  - You are about to drop the column `extractionId` on the `FoundDocumentCase` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "FoundDocumentCase" DROP CONSTRAINT "FoundDocumentCase_extractionId_fkey";

-- AlterTable
ALTER TABLE "DocumentCase" ADD COLUMN     "extractionId" TEXT;

-- AlterTable
ALTER TABLE "FoundDocumentCase" DROP COLUMN "extractionId";

-- AddForeignKey
ALTER TABLE "DocumentCase" ADD CONSTRAINT "DocumentCase_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "AIExtraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
