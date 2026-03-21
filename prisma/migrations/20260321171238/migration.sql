/*
  Warnings:

  - You are about to drop the column `documentCaseId` on the `notification_logs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_documentCaseId_fkey";

-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_templateId_fkey";

-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_userId_fkey";

-- AlterTable
ALTER TABLE "notification_logs" DROP COLUMN "documentCaseId";

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
