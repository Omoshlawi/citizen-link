/*
  Warnings:

  - The values [MATCHED,CLAIMED] on the enum `FoundDocumentCaseStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [MATCHED] on the enum `LostDocumentCaseStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FoundDocumentCaseStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'COMPLETED');
ALTER TABLE "public"."FoundDocumentCase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "FoundDocumentCase" ALTER COLUMN "status" TYPE "FoundDocumentCaseStatus_new" USING ("status"::text::"FoundDocumentCaseStatus_new");
ALTER TYPE "FoundDocumentCaseStatus" RENAME TO "FoundDocumentCaseStatus_old";
ALTER TYPE "FoundDocumentCaseStatus_new" RENAME TO "FoundDocumentCaseStatus";
DROP TYPE "public"."FoundDocumentCaseStatus_old";
ALTER TABLE "FoundDocumentCase" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "LostDocumentCaseStatus_new" AS ENUM ('SUBMITTED', 'COMPLETED');
ALTER TABLE "public"."LostDocumentCase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LostDocumentCase" ALTER COLUMN "status" TYPE "LostDocumentCaseStatus_new" USING ("status"::text::"LostDocumentCaseStatus_new");
ALTER TYPE "LostDocumentCaseStatus" RENAME TO "LostDocumentCaseStatus_old";
ALTER TYPE "LostDocumentCaseStatus_new" RENAME TO "LostDocumentCaseStatus";
DROP TYPE "public"."LostDocumentCaseStatus_old";
ALTER TABLE "LostDocumentCase" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;
