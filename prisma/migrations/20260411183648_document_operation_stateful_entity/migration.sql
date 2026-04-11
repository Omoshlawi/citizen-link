/*
  Warnings:

  - You are about to drop the column `custodyStatusAfter` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `custodyStatusBefore` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `foundCaseId` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `pairedOperationId` on the `document_operations` table. All the data in the column will be lost.
  - You are about to drop the column `performedById` on the `document_operations` table. All the data in the column will be lost.
  - Added the required column `createdById` to the `document_operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `document_operations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `document_operations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentOperationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentOperationItemStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_foundCaseId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_pairedOperationId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_performedById_fkey";

-- DropIndex
DROP INDEX "document_operations_foundCaseId_idx";

-- DropIndex
DROP INDEX "document_operations_pairedOperationId_key";

-- AlterTable
ALTER TABLE "document_operations" DROP COLUMN "custodyStatusAfter",
DROP COLUMN "custodyStatusBefore",
DROP COLUMN "foundCaseId",
DROP COLUMN "pairedOperationId",
DROP COLUMN "performedById",
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "status" "DocumentOperationStatus" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "document_operation_items" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "foundCaseId" TEXT NOT NULL,
    "status" "DocumentOperationItemStatus" NOT NULL,
    "custodyStatusBefore" "CustodyStatus",
    "custodyStatusAfter" "CustodyStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_operation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_operation_items_foundCaseId_idx" ON "document_operation_items"("foundCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "document_operation_items_operationId_foundCaseId_key" ON "document_operation_items"("operationId", "foundCaseId");

-- CreateIndex
CREATE INDEX "document_operations_status_idx" ON "document_operations"("status");

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operation_items" ADD CONSTRAINT "document_operation_items_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "document_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operation_items" ADD CONSTRAINT "document_operation_items_foundCaseId_fkey" FOREIGN KEY ("foundCaseId") REFERENCES "found_document_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
