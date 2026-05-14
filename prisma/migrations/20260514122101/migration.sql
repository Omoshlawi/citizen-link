/*
  Warnings:

  - You are about to drop the column `finderReward` on the `invoices` table. All the data in the column will be lost.
  - You are about to drop the column `serviceFee` on the `invoices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "finderReward",
DROP COLUMN "serviceFee";
