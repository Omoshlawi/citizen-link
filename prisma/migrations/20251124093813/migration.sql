/*
  Warnings:

  - You are about to drop the column `reportId` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `foundReportId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `lostReportId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `reportId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `foundReportsCount` on the `Statistic` table. All the data in the column will be lost.
  - You are about to drop the column `lostReportsCount` on the `Statistic` table. All the data in the column will be lost.
  - You are about to drop the `FoundReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LostReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Report` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[caseId]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `caseId` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `foundDocumentCaseId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lostDocumentCaseId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentCaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'MATCHED', 'RETURNED', 'EXPIRED', 'CLAIMED', 'PENDING_VERIFICATION', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_reportId_fkey";

-- DropForeignKey
ALTER TABLE "FoundReport" DROP CONSTRAINT "FoundReport_reportId_fkey";

-- DropForeignKey
ALTER TABLE "LostReport" DROP CONSTRAINT "LostReport_reportId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_foundReportId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_lostReportId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_reportId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_addressId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_userId_fkey";

-- DropIndex
DROP INDEX "Document_reportId_key";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "reportId",
ADD COLUMN     "caseId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "foundReportId",
DROP COLUMN "lostReportId",
ADD COLUMN     "foundDocumentCaseId" TEXT NOT NULL,
ADD COLUMN     "lostDocumentCaseId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "reportId",
ADD COLUMN     "caseId" TEXT;

-- AlterTable
ALTER TABLE "Statistic" DROP COLUMN "foundReportsCount",
DROP COLUMN "lostReportsCount",
ADD COLUMN     "foundCasesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lostCasesCount" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "FoundReport";

-- DropTable
DROP TABLE "LostReport";

-- DropTable
DROP TABLE "Report";

-- DropEnum
DROP TYPE "ReportStatus";

-- CreateTable
CREATE TABLE "DocumentCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "addressId" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "status" "DocumentCaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DocumentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostDocumentCase" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostDocumentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundDocumentCase" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pointAwarded" INTEGER NOT NULL DEFAULT 0,
    "securityQuestion" TEXT,
    "securityAnswer" TEXT,

    CONSTRAINT "FoundDocumentCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentCase_eventDate_idx" ON "DocumentCase"("eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "LostDocumentCase_caseId_key" ON "LostDocumentCase"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundDocumentCase_caseId_key" ON "FoundDocumentCase"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_caseId_key" ON "Document"("caseId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCase" ADD CONSTRAINT "DocumentCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCase" ADD CONSTRAINT "DocumentCase_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostDocumentCase" ADD CONSTRAINT "LostDocumentCase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundDocumentCase" ADD CONSTRAINT "FoundDocumentCase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_lostDocumentCaseId_fkey" FOREIGN KEY ("lostDocumentCaseId") REFERENCES "LostDocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_foundDocumentCaseId_fkey" FOREIGN KEY ("foundDocumentCaseId") REFERENCES "FoundDocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
