-- CreateEnum
CREATE TYPE "DeliveryZone" AS ENUM ('LOCAL', 'COUNTY', 'NATIONAL');

-- AlterTable
ALTER TABLE "document_exchanges" ADD COLUMN     "addressSnapshot" JSONB,
ADD COLUMN     "deliveryZone" "DeliveryZone",
ADD COLUMN     "stationSnapshot" JSONB;
