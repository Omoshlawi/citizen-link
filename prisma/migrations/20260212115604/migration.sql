/*
  Warnings:

  - You are about to drop the column `preferredRecoveryDate` on the `Claim` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "preferredRecoveryDate",
ADD COLUMN     "preferredHandoverDate" TIMESTAMP(3);
