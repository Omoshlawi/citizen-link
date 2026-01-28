/*
  Warnings:

  - You are about to drop the column `maxAttempts` on the `Claim` table. All the data in the column will be lost.
  - You are about to drop the column `verificationAttempts` on the `Claim` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `Claim` table. All the data in the column will be lost.
  - You are about to drop the `AIVerificationAttempt` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AIVerificationAttempt" DROP CONSTRAINT "AIVerificationAttempt_claimId_fkey";

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "maxAttempts",
DROP COLUMN "verificationAttempts",
DROP COLUMN "verifiedAt";

-- DropTable
DROP TABLE "AIVerificationAttempt";

-- CreateTable
CREATE TABLE "AIVerification" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "aiInteractionId" TEXT NOT NULL,
    "userResponses" JSONB NOT NULL,
    "aiAnalysis" JSONB NOT NULL,
    "overallVerdict" "VerificationVerdict" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "flexibilityApplied" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIVerification_claimId_key" ON "AIVerification"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "AIVerification_aiInteractionId_key" ON "AIVerification"("aiInteractionId");

-- CreateIndex
CREATE INDEX "AIVerification_claimId_idx" ON "AIVerification"("claimId");

-- AddForeignKey
ALTER TABLE "AIVerification" ADD CONSTRAINT "AIVerification_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIVerification" ADD CONSTRAINT "AIVerification_aiInteractionId_fkey" FOREIGN KEY ("aiInteractionId") REFERENCES "AIInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
