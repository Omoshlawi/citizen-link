-- DropForeignKey
ALTER TABLE "document_operation_items" DROP CONSTRAINT "document_operation_items_foundCaseId_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_createdById_fkey";

-- DropForeignKey
ALTER TABLE "document_operations" DROP CONSTRAINT "document_operations_operationTypeId_fkey";

-- DropForeignKey
ALTER TABLE "staff_station_operations" DROP CONSTRAINT "staff_station_operations_grantedById_fkey";

-- AddForeignKey
ALTER TABLE "staff_station_operations" ADD CONSTRAINT "staff_station_operations_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_operationTypeId_fkey" FOREIGN KEY ("operationTypeId") REFERENCES "document_operation_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_operation_items" ADD CONSTRAINT "document_operation_items_foundCaseId_fkey" FOREIGN KEY ("foundCaseId") REFERENCES "found_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
