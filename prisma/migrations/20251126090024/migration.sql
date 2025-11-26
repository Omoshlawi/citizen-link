/*
  Warnings:

  - You are about to drop the column `localeFormat` on the `Address` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Address" DROP COLUMN "localeFormat",
ADD COLUMN     "localeId" TEXT;

-- CreateTable
CREATE TABLE "AddressLocale" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "regionName" TEXT NOT NULL,
    "description" TEXT,
    "formatSpec" JSONB NOT NULL,
    "examples" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AddressLocale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AddressLocale_code_key" ON "AddressLocale"("code");

-- CreateIndex
CREATE INDEX "AddressLocale_country_idx" ON "AddressLocale"("country");

-- CreateIndex
CREATE INDEX "AddressLocale_regionName_idx" ON "AddressLocale"("regionName");

-- CreateIndex
CREATE INDEX "Address_localeId_idx" ON "Address"("localeId");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "AddressLocale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
