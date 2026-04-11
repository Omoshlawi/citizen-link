/*
  Warnings:

  - You are about to drop the column `approvedById` on the `document_operations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_approvedById_fkey";

-- AlterTable
ALTER TABLE "document_operations" DROP COLUMN "approvedById";
