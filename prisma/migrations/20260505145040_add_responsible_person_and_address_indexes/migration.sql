-- AlterTable
ALTER TABLE "document_operations" ADD COLUMN     "responsiblePersonId" TEXT;

-- CreateIndex
CREATE INDEX "addresses_level3_idx" ON "addresses"("level3");

-- AddForeignKey
ALTER TABLE "document_operations" ADD CONSTRAINT "document_operations_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
