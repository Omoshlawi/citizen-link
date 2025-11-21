/*
  Warnings:

  - Added the required column `customerId` to the `SMSNotification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SMSNotification" ADD COLUMN     "customerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "SMSNotification" ADD CONSTRAINT "SMSNotification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
