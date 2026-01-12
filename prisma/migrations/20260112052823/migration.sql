/*
  Warnings:

  - You are about to drop the `AIMatchInteraction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AIMatchInteraction" DROP CONSTRAINT "AIMatchInteraction_aiInteractionId_fkey";

-- DropForeignKey
ALTER TABLE "AIMatchInteraction" DROP CONSTRAINT "AIMatchInteraction_matchId_fkey";

-- DropTable
DROP TABLE "AIMatchInteraction";
