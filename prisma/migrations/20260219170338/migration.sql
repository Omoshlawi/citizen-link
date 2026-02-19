/*
  Warnings:

  - The values [EXPIRED] on the enum `MatchStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MatchStatus_new" AS ENUM ('PENDING', 'REJECTED', 'CLAIMED');
ALTER TABLE "public"."matches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "matches" ALTER COLUMN "status" TYPE "MatchStatus_new" USING ("status"::text::"MatchStatus_new");
ALTER TYPE "MatchStatus" RENAME TO "MatchStatus_old";
ALTER TYPE "MatchStatus_new" RENAME TO "MatchStatus";
DROP TYPE "public"."MatchStatus_old";
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "document_embedding_idx";

-- CreateTable
CREATE TABLE "transition_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT '*',
    "fromStatus" TEXT NOT NULL DEFAULT '*',
    "toStatus" TEXT NOT NULL DEFAULT '*',
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transition_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_transitions" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reasonId" TEXT,
    "comment" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transition_reasons_entityType_idx" ON "transition_reasons"("entityType");

-- CreateIndex
CREATE INDEX "transition_reasons_entityType_fromStatus_toStatus_idx" ON "transition_reasons"("entityType", "fromStatus", "toStatus");

-- CreateIndex
CREATE INDEX "transition_reasons_toStatus_idx" ON "transition_reasons"("toStatus");

-- CreateIndex
CREATE UNIQUE INDEX "transition_reasons_entityType_fromStatus_toStatus_code_key" ON "transition_reasons"("entityType", "fromStatus", "toStatus", "code");

-- CreateIndex
CREATE INDEX "status_transitions_entityId_entityType_idx" ON "status_transitions"("entityId", "entityType");

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "transition_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_transitions" ADD CONSTRAINT "status_transitions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
