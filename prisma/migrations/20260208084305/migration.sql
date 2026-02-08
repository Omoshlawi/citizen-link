/*
  Warnings:

  - A unique constraint covering the columns `[lostDocumentCaseId,foundDocumentCaseId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Match_lostDocumentCaseId_foundDocumentCaseId_key" ON "Match"("lostDocumentCaseId", "foundDocumentCaseId");
