/*
  Warnings:

  - You are about to drop the column `status` on the `DocumentCase` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LostDocumentCaseStatus" AS ENUM ('SUBMITTED', 'MATCHED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FoundDocumentCaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'MATCHED', 'CLAIMED', 'COMPLETED');

-- AlterTable
ALTER TABLE "DocumentCase" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "FoundDocumentCase" ADD COLUMN     "status" "FoundDocumentCaseStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "LostDocumentCase" ADD COLUMN     "status" "LostDocumentCaseStatus" NOT NULL DEFAULT 'COMPLETED';

-- DropEnum
DROP TYPE "DocumentCaseStatus";
