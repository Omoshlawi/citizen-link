/*
  Warnings:

  - You are about to drop the `ai_interactions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_interactions" DROP CONSTRAINT "ai_interactions_userId_fkey";

-- DropTable
DROP TABLE "ai_interactions";

-- DropEnum
DROP TYPE "AIInteractionType";
