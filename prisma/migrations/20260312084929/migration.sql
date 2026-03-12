/*
  Warnings:

  - You are about to drop the `case_status_transitions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "case_status_transitions" DROP CONSTRAINT "case_status_transitions_caseId_fkey";

-- AlterTable
ALTER TABLE "status_transitions" ADD COLUMN     "metadata" JSONB;

-- DropTable
DROP TABLE "case_status_transitions";

-- DropEnum
DROP TYPE "ActorType";

-- DropEnum
DROP TYPE "CaseType";
