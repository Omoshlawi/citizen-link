/*
  Warnings:

  - The `matchNumber` column on the `Match` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[aiInteractionId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `aiInteractionId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Match_matchNumber_key";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "aiInteractionId" TEXT NOT NULL,
DROP COLUMN "matchNumber",
ADD COLUMN     "matchNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Match_aiInteractionId_key" ON "Match"("aiInteractionId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_aiInteractionId_fkey" FOREIGN KEY ("aiInteractionId") REFERENCES "AIExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
