-- CreateEnum
CREATE TYPE "SubmissionMethod" AS ENUM ('DROPOFF', 'PICKUP');

-- AlterTable
ALTER TABLE "found_document_cases" ADD COLUMN     "collectionAddressId" TEXT,
ADD COLUMN     "scheduledPickupAt" TIMESTAMP(3),
ADD COLUMN     "submissionMethod" "SubmissionMethod";

-- AddForeignKey
ALTER TABLE "found_document_cases" ADD CONSTRAINT "found_document_cases_collectionAddressId_fkey" FOREIGN KEY ("collectionAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
