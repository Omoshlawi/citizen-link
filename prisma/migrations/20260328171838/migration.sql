/*
  Warnings:

  - You are about to drop the column `success` on the `ai_extractions` table. All the data in the column will be lost.
  - You are about to drop the column `extractionId` on the `document_cases` table. All the data in the column will be lost.
  - You are about to drop the column `aiInteractionId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `aiScore` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `aiVerificationResult` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `securityQuestions` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `securityQuestionsAiInteractionId` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the `case_status_transitions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[caseId]` on the table `ai_extractions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[key,userId]` on the table `settings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `caseId` to the `ai_extractions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionStep" AS ENUM ('VISION', 'TEXT', 'POST_PROCESSING');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- DropForeignKey
ALTER TABLE "case_status_transitions" DROP CONSTRAINT "case_status_transitions_caseId_fkey";

-- DropForeignKey
ALTER TABLE "document_cases" DROP CONSTRAINT "document_cases_extractionId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_aiInteractionId_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_securityQuestionsAiInteractionId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_documentCaseId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropIndex
DROP INDEX "document_embedding_ada_idx";

-- DropIndex
DROP INDEX "document_embedding_idx";

-- DropIndex
DROP INDEX "matches_aiInteractionId_key";

-- DropIndex
DROP INDEX "matches_securityQuestionsAiInteractionId_key";

-- DropIndex
DROP INDEX "settings_key_key";

-- AlterTable
ALTER TABLE "ai_extractions" DROP COLUMN "success",
ADD COLUMN     "caseId" TEXT NOT NULL,
ADD COLUMN     "currentStep" "ExtractionStep",
ADD COLUMN     "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "document_cases" DROP COLUMN "extractionId";

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "aiInteractionId",
DROP COLUMN "aiScore",
DROP COLUMN "aiVerificationResult",
DROP COLUMN "securityQuestions",
DROP COLUMN "securityQuestionsAiInteractionId";

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" TEXT NOT NULL DEFAULT '*';

-- AlterTable
ALTER TABLE "status_transitions" ADD COLUMN     "metadata" JSONB;

-- DropTable
DROP TABLE "case_status_transitions";

-- DropTable
DROP TABLE "notifications";

-- DropEnum
DROP TYPE "ActorType";

-- DropEnum
DROP TYPE "CaseType";

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "engine" TEXT NOT NULL DEFAULT 'handlebars',
    "slots" JSONB NOT NULL,
    "schema" JSONB,
    "metadata" JSONB,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "slots" JSONB NOT NULL,
    "schema" JSONB,
    "metadata" JSONB,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "description" TEXT,
    "readAt" TIMESTAMP(3),
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "templateId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "recipientId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "metadata" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_push_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'expo',
    "deviceName" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "templates_key_key" ON "templates"("key");

-- CreateIndex
CREATE INDEX "template_versions_templateId_idx" ON "template_versions"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_templateId_version_key" ON "template_versions"("templateId", "version");

-- CreateIndex
CREATE INDEX "notification_events_userId_idx" ON "notification_events"("userId");

-- CreateIndex
CREATE INDEX "notification_events_createdAt_idx" ON "notification_events"("createdAt");

-- CreateIndex
CREATE INDEX "notification_logs_eventId_idx" ON "notification_logs"("eventId");

-- CreateIndex
CREATE INDEX "notification_logs_recipientId_idx" ON "notification_logs"("recipientId");

-- CreateIndex
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "notification_logs_channel_idx" ON "notification_logs"("channel");

-- CreateIndex
CREATE INDEX "notification_logs_createdAt_idx" ON "notification_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_push_tokens_token_key" ON "user_push_tokens"("token");

-- CreateIndex
CREATE INDEX "user_push_tokens_userId_idx" ON "user_push_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_extractions_caseId_key" ON "ai_extractions"("caseId");

-- CreateIndex
CREATE INDEX "settings_userId_idx" ON "settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_userId_key" ON "settings"("key", "userId");

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_push_tokens" ADD CONSTRAINT "user_push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
