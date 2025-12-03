/*
  Warnings:

  - You are about to drop the `case_status_transition` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "case_status_transition" DROP CONSTRAINT "case_status_transition_caseId_fkey";

-- DropTable
DROP TABLE "case_status_transition";

-- CreateTable
CREATE TABLE "CaseStatusTransition" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "caseType" "CaseType" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "deviceId" TEXT,
    "deviceLocation" TEXT,
    "deviceMetadata" JSONB,
    "verificationResult" JSONB,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseStatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseStatusTransition_caseId_idx" ON "CaseStatusTransition"("caseId");

-- CreateIndex
CREATE INDEX "CaseStatusTransition_caseId_caseType_idx" ON "CaseStatusTransition"("caseId", "caseType");

-- CreateIndex
CREATE INDEX "CaseStatusTransition_actorType_actorId_idx" ON "CaseStatusTransition"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "CaseStatusTransition_toStatus_idx" ON "CaseStatusTransition"("toStatus");

-- CreateIndex
CREATE INDEX "CaseStatusTransition_createdAt_idx" ON "CaseStatusTransition"("createdAt");

-- AddForeignKey
ALTER TABLE "CaseStatusTransition" ADD CONSTRAINT "CaseStatusTransition_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
