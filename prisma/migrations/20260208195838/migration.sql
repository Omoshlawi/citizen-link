/*
  Warnings:

  - The `claimNumber` column on the `Claim` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "claimNumber",
ADD COLUMN     "claimNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Claim_claimNumber_key" ON "Claim"("claimNumber");
