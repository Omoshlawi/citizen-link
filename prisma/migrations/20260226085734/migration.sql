/*
  Warnings:

  - You are about to drop the `disputes` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'UNDER_REVIEW';

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_claimId_fkey";

-- DropForeignKey
ALTER TABLE "disputes" DROP CONSTRAINT "disputes_initiatedBy_fkey";

-- AlterTable
ALTER TABLE "transition_reasons" ADD COLUMN     "metadata" JSONB;

-- DropTable
DROP TABLE "disputes";

-- DropEnum
DROP TYPE "DisputeStatus";

-- DropEnum
DROP TYPE "DisputeType";
