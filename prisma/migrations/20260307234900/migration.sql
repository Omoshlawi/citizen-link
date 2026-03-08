/*
  Warnings:

  - You are about to drop the column `aiInteractionId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `aiScore` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `aiVerificationResult` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `securityQuestions` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `securityQuestionsAiInteractionId` on the `matches` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_aiInteractionId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_securityQuestionsAiInteractionId_fkey";

-- DropIndex
DROP INDEX "matches_aiInteractionId_key";

-- DropIndex
DROP INDEX "matches_securityQuestionsAiInteractionId_key";

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "aiInteractionId",
DROP COLUMN "aiScore",
DROP COLUMN "aiVerificationResult",
DROP COLUMN "securityQuestions",
DROP COLUMN "securityQuestionsAiInteractionId";
