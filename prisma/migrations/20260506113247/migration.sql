-- AlterTable
ALTER TABLE "document_operation_items" ADD COLUMN     "userAddressId" TEXT;

-- AlterTable
ALTER TABLE "document_operation_types" ADD COLUMN     "requiresItemAddresses" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresTargetArea" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "document_operations" ADD COLUMN     "targetArea" TEXT;

-- AddForeignKey
ALTER TABLE "document_operation_items" ADD CONSTRAINT "document_operation_items_userAddressId_fkey" FOREIGN KEY ("userAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
