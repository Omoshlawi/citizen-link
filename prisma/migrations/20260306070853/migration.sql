/*
  Warnings:

  - A unique constraint covering the columns `[securityQuestionsAiInteractionId]` on the table `matches` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `securityQuestionsAiInteractionId` to the `matches` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "securityQuestions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "securityQuestionsAiInteractionId" TEXT NOT NULL,
ALTER COLUMN "aiVerificationResult" SET DATA TYPE JSONB,
ALTER COLUMN "layer2FieldScores" SET DATA TYPE JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "matches_securityQuestionsAiInteractionId_key" ON "matches"("securityQuestionsAiInteractionId");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_securityQuestionsAiInteractionId_fkey" FOREIGN KEY ("securityQuestionsAiInteractionId") REFERENCES "ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
