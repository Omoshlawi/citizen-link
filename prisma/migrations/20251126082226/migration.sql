/*
  Warnings:

  - The values [BRANCH,WAREHOUSE] on the enum `AddressType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AddressType_new" AS ENUM ('HOME', 'WORK', 'BILLING', 'SHIPPING', 'OFFICE', 'OTHER');
ALTER TABLE "public"."Address" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Address" ALTER COLUMN "type" TYPE "AddressType_new" USING ("type"::text::"AddressType_new");
ALTER TYPE "AddressType" RENAME TO "AddressType_old";
ALTER TYPE "AddressType_new" RENAME TO "AddressType";
DROP TYPE "public"."AddressType_old";
ALTER TABLE "Address" ALTER COLUMN "type" SET DEFAULT 'OTHER';
COMMIT;
