/*
  Warnings:

  - You are about to drop the column `finderReward` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `serviceFee` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `claims` table. All the data in the column will be lost.
  - You are about to drop the column `claimId` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `finderReward` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `paidAt` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `platformFee` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `refundedAt` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `serviceFee` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `transactions` table. All the data in the column will be lost.
  - Added the required column `amount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `invoiceId` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_claimId_fkey";

-- DropIndex
DROP INDEX "transactions_claimId_idx";

-- DropIndex
DROP INDEX "transactions_claimId_key";

-- AlterTable
ALTER TABLE "claims" DROP COLUMN "finderReward",
DROP COLUMN "serviceFee",
DROP COLUMN "totalAmount",
ADD COLUMN     "pickupAddressId" TEXT;

-- AlterTable
ALTER TABLE "document_types" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "finderReward" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "serviceFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "claimId",
DROP COLUMN "finderReward",
DROP COLUMN "paidAt",
DROP COLUMN "platformFee",
DROP COLUMN "refundedAt",
DROP COLUMN "serviceFee",
DROP COLUMN "totalAmount",
ADD COLUMN     "amount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "invoiceId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "serviceFee" DECIMAL(10,2) NOT NULL,
    "finderReward" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "balanceDue" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_claimId_key" ON "invoices"("claimId");

-- CreateIndex
CREATE INDEX "invoices_claimId_idx" ON "invoices"("claimId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "transactions_invoiceId_idx" ON "transactions"("invoiceId");

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
