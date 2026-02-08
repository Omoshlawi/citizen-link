/*
  Warnings:

  - A unique constraint covering the columns `[matchNumber]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Match_lostDocumentCaseId_foundDocumentCaseId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Match_matchNumber_key" ON "Match"("matchNumber");
