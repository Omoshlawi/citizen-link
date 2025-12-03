/*
  Warnings:

  - Made the column `fromStatus` on table `case_status_transition` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "case_status_transition" ALTER COLUMN "fromStatus" SET NOT NULL;
