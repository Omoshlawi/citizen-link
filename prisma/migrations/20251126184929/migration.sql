/*
  Warnings:

  - You are about to drop the column `securityAnswer` on the `FoundDocumentCase` table. All the data in the column will be lost.
  - The `securityQuestion` column on the `FoundDocumentCase` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "FoundDocumentCase" DROP COLUMN "securityAnswer",
DROP COLUMN "securityQuestion",
ADD COLUMN     "securityQuestion" JSONB DEFAULT '[]';
