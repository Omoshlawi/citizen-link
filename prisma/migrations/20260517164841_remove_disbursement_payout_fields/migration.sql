/*
  Warnings:

  - You are about to drop the column `completedAt` on the `disbursements` table. All the data in the column will be lost.
  - You are about to drop the column `initiatedAt` on the `disbursements` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `disbursements` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `disbursements` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProvider` on the `disbursements` table. All the data in the column will be lost.
  - You are about to drop the column `providerTransactionId` on the `disbursements` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `disbursements` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "disbursements_status_idx";

-- AlterTable
ALTER TABLE "disbursements" DROP COLUMN "completedAt",
DROP COLUMN "initiatedAt",
DROP COLUMN "metadata",
DROP COLUMN "paymentMethod",
DROP COLUMN "paymentProvider",
DROP COLUMN "providerTransactionId",
DROP COLUMN "status";

-- DropEnum
DROP TYPE "DisbursementStatus";
