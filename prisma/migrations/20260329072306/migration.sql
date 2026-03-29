/*
  Warnings:

  - You are about to drop the column `finderPresent` on the `handovers` table. All the data in the column will be lost.
  - You are about to drop the column `finderSignature` on the `handovers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "handovers" DROP COLUMN "finderPresent",
DROP COLUMN "finderSignature";
