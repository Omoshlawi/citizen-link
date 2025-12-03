-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'DEVICE', 'SYSTEM');

-- CreateTable
CREATE TABLE "case_status_transition" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" TEXT,
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

    CONSTRAINT "case_status_transition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_status_transition_caseId_idx" ON "case_status_transition"("caseId");

-- CreateIndex
CREATE INDEX "case_status_transition_caseId_caseType_idx" ON "case_status_transition"("caseId", "caseType");

-- CreateIndex
CREATE INDEX "case_status_transition_actorType_actorId_idx" ON "case_status_transition"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "case_status_transition_toStatus_idx" ON "case_status_transition"("toStatus");

-- CreateIndex
CREATE INDEX "case_status_transition_createdAt_idx" ON "case_status_transition"("createdAt");

-- AddForeignKey
ALTER TABLE "case_status_transition" ADD CONSTRAINT "case_status_transition_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DocumentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
