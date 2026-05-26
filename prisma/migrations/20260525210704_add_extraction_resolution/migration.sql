-- CreateEnum
CREATE TYPE "ExtractionResolutionType" AS ENUM ('RESUBMIT_IMAGE', 'SUBMIT_NEW_CASE', 'STAFF_HANDLING');

-- AlterTable
ALTER TABLE "ai_extractions" ADD COLUMN     "resolutionMessage" TEXT,
ADD COLUMN     "resolutionType" "ExtractionResolutionType",
ADD COLUMN     "resolvedById" TEXT;

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
