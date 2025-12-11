/*
  Warnings:

  - You are about to drop the column `aiModel` on the `AIExtraction` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `AIExtraction` table. All the data in the column will be lost.
  - You are about to drop the column `rawInput` on the `AIExtraction` table. All the data in the column will be lost.
  - You are about to drop the column `rawOutput` on the `AIExtraction` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `AIExtraction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[aiInteractionId]` on the table `AIExtraction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `aiInteractionId` to the `AIExtraction` table without a default value. This is not possible if the table is not empty.
  - Made the column `documentId` on table `AIExtraction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "AIExtraction_status_idx";

-- AlterTable
ALTER TABLE "AIExtraction" DROP COLUMN "aiModel",
DROP COLUMN "errorMessage",
DROP COLUMN "rawInput",
DROP COLUMN "rawOutput",
DROP COLUMN "status",
ADD COLUMN     "aiInteractionId" TEXT NOT NULL,
ALTER COLUMN "documentId" SET NOT NULL;

-- DropEnum
DROP TYPE "AIExtractionStatus";

-- CreateIndex
CREATE UNIQUE INDEX "AIExtraction_aiInteractionId_key" ON "AIExtraction"("aiInteractionId");

-- AddForeignKey
ALTER TABLE "AIExtraction" ADD CONSTRAINT "AIExtraction_aiInteractionId_fkey" FOREIGN KEY ("aiInteractionId") REFERENCES "AIInteraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
