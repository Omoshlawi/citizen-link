-- CreateEnum
CREATE TYPE "DocumentCollectionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "document_collections" (
    "id" TEXT NOT NULL,
    "foundCaseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "DocumentCollectionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "initiatedById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_collections_foundCaseId_status_idx" ON "document_collections"("foundCaseId", "status");

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_foundCaseId_fkey" FOREIGN KEY ("foundCaseId") REFERENCES "found_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_collections" ADD CONSTRAINT "document_collections_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
