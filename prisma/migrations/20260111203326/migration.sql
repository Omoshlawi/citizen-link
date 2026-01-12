/*
  Warnings:

  - You are about to drop the column `aiModel` on the `Match` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Match_aiModel_idx";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "aiModel";

-- CreateTable
CREATE TABLE "AIMatchInteraction" (
    "id" TEXT NOT NULL,
    "aiInteractionId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "extractionData" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMatchInteraction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AIMatchInteraction" ADD CONSTRAINT "AIMatchInteraction_aiInteractionId_fkey" FOREIGN KEY ("aiInteractionId") REFERENCES "AIInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMatchInteraction" ADD CONSTRAINT "AIMatchInteraction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
