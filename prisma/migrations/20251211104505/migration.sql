-- DropForeignKey
ALTER TABLE "AIExtraction" DROP CONSTRAINT "AIExtraction_documentId_fkey";

-- DropIndex
DROP INDEX "AIExtraction_documentId_idx";

-- AlterTable
ALTER TABLE "AIExtraction" ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "FoundDocumentCase" ADD COLUMN     "extractionId" TEXT;

-- CreateIndex
CREATE INDEX "AIExtraction_aiInteractionId_idx" ON "AIExtraction"("aiInteractionId");

-- AddForeignKey
ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundDocumentCase" ADD CONSTRAINT "FoundDocumentCase_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "AIExtraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
