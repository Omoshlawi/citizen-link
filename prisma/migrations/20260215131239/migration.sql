-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('HOME', 'WORK', 'BILLING', 'SHIPPING', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'ACADEMIC', 'PROFESSIONAL', 'VEHICLE', 'FINANCIAL', 'MEDICAL', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AIExtractionInteractionType" AS ENUM ('DATA_EXTRACTION', 'CONFIDENCE_SCORE', 'IMAGE_ANALYSIS', 'SECURITY_QUESTIONS');

-- CreateEnum
CREATE TYPE "LostDocumentCaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FoundDocumentCaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'DEVICE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'REJECTED', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIInteractionType" AS ENUM ('DATA_EXTRACTION', 'CONFIDENCE_SCORE', 'DOCUMENT_MATCHING', 'CLAIM_VERIFICATION', 'IMAGE_ANALYSIS', 'SECURITY_QUESTIONS_GEN', 'DISPUTE_ANALYSIS', 'USER_QUERY_RESPONSE', 'ALTERNATIVE_MATCHES');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'WALLET');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MATCH_FOUND', 'CLAIM_VERIFIED', 'PAYMENT_RECEIVED', 'PICKUP_READY', 'HANDOVER_SCHEDULED', 'HANDOVER_COMPLETED', 'RATING_RECEIVED', 'DOCUMENT_EXPIRED', 'SYSTEM_ALERT');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('VERIFICATION_ERROR', 'ADMIN_OVERRIDE', 'FRAUD_SUSPECTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "banned" BOOLEAN,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "username" TEXT,
    "displayUsername" TEXT,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "phoneNumber" TEXT,
    "phoneNumberVerified" BOOLEAN,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jwks" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "description" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'OTHER',
    "label" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "landmark" TEXT,
    "level1" TEXT NOT NULL,
    "level2" TEXT,
    "level3" TEXT,
    "level4" TEXT,
    "level5" TEXT,
    "cityVillage" TEXT,
    "stateProvince" TEXT,
    "country" TEXT NOT NULL DEFAULT 'KE',
    "postalCode" TEXT,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "plusCode" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "formatted" TEXT,
    "localeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_hierarchy" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocal" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "address_hierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_locales" (
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

    CONSTRAINT "address_locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "loyaltyPoints" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "replacementInstructions" TEXT,
    "averageReplacementCost" DOUBLE PRECISION,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "aiExtractionPrompt" TEXT,
    "verificationStrategy" JSONB NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT,
    "serialNumber" TEXT,
    "batchNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "placeOfBirth" TEXT,
    "gender" TEXT,
    "fullName" TEXT,
    "issuer" TEXT,
    "typeId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "issuanceDate" TIMESTAMP(3),
    "placeOfIssue" TEXT,
    "expiryDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_fields" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "blurredUrl" TEXT,
    "aiAnalysis" JSONB,
    "documentId" TEXT,
    "imageType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_extractions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_extraction_interactions" (
    "id" TEXT NOT NULL,
    "aiInteractionId" TEXT NOT NULL,
    "aiExtractionId" TEXT NOT NULL,
    "extractionData" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "extractionType" "AIExtractionInteractionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_extraction_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_cases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "addressId" TEXT NOT NULL,
    "extractionId" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "document_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_document_cases" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "LostDocumentCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_document_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "found_document_cases" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "FoundDocumentCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pointAwarded" INTEGER NOT NULL DEFAULT 0,
    "securityQuestion" JSONB DEFAULT '[]',
    "pickupStationId" TEXT,

    CONSTRAINT "found_document_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_transitions" (
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

    CONSTRAINT "case_status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "matchNumber" SERIAL NOT NULL,
    "aiInteractionId" TEXT NOT NULL,
    "lostDocumentCaseId" TEXT NOT NULL,
    "foundDocumentCaseId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "aiAnalysis" JSON NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "claimNumber" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "foundDocumentCaseId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "pickupStationId" TEXT,
    "preferredHandoverDate" TIMESTAMP(3),
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "serviceFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finderReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_attachments" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_verifications" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "userResponses" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "interactionType" "AIInteractionType" NOT NULL,
    "aiModel" TEXT NOT NULL,
    "modelVersion" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokenUsage" JSONB,
    "processingTime" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_stations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLocaleCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'KE',
    "postalCode" TEXT,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "landmark" TEXT,
    "level1" TEXT NOT NULL,
    "level2" TEXT,
    "level3" TEXT,
    "level4" TEXT,
    "level5" TEXT,
    "coordinates" JSONB NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "formatted" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "operatingHours" JSONB,

    CONSTRAINT "pickup_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handovers" (
    "id" TEXT NOT NULL,
    "handoverNumber" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "pickupStationId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "ownerVerified" BOOLEAN NOT NULL DEFAULT false,
    "finderPresent" BOOLEAN NOT NULL DEFAULT false,
    "ownerSignature" TEXT,
    "finderSignature" TEXT,
    "handoverNotes" TEXT,
    "status" "HandoverStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "serviceFee" DOUBLE PRECISION NOT NULL,
    "finderReward" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentProvider" TEXT,
    "providerTransactionId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "aiSentiment" JSONB,
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "sentViaSMS" BOOLEAN NOT NULL DEFAULT false,
    "sentViaPush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentCaseId" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "disputeNumber" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "aiAnalysis" JSONB,
    "disputeType" "DisputeType" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "participants" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "title" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_phoneNumber_key" ON "user"("phoneNumber");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "user_activities_userId_idx" ON "user_activities"("userId");

-- CreateIndex
CREATE INDEX "user_activities_createdAt_idx" ON "user_activities"("createdAt");

-- CreateIndex
CREATE INDEX "user_activities_resource_resourceId_idx" ON "user_activities"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "addresses_userId_idx" ON "addresses"("userId");

-- CreateIndex
CREATE INDEX "addresses_userId_preferred_idx" ON "addresses"("userId", "preferred");

-- CreateIndex
CREATE INDEX "addresses_country_idx" ON "addresses"("country");

-- CreateIndex
CREATE INDEX "addresses_localeId_idx" ON "addresses"("localeId");

-- CreateIndex
CREATE INDEX "addresses_level1_level2_level3_idx" ON "addresses"("level1", "level2", "level3");

-- CreateIndex
CREATE INDEX "address_hierarchy_country_level_idx" ON "address_hierarchy"("country", "level");

-- CreateIndex
CREATE INDEX "address_hierarchy_parentId_idx" ON "address_hierarchy"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "address_hierarchy_country_code_key" ON "address_hierarchy"("country", "code");

-- CreateIndex
CREATE UNIQUE INDEX "address_locales_code_key" ON "address_locales"("code");

-- CreateIndex
CREATE INDEX "address_locales_country_idx" ON "address_locales"("country");

-- CreateIndex
CREATE INDEX "address_locales_regionName_idx" ON "address_locales"("regionName");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_name_key" ON "document_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "documents_caseId_key" ON "documents"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "document_fields_documentId_fieldName_key" ON "document_fields"("documentId", "fieldName");

-- CreateIndex
CREATE UNIQUE INDEX "document_images_url_key" ON "document_images"("url");

-- CreateIndex
CREATE INDEX "document_cases_eventDate_idx" ON "document_cases"("eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "lost_document_cases_caseId_key" ON "lost_document_cases"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "found_document_cases_caseId_key" ON "found_document_cases"("caseId");

-- CreateIndex
CREATE INDEX "case_status_transitions_caseId_idx" ON "case_status_transitions"("caseId");

-- CreateIndex
CREATE INDEX "case_status_transitions_caseId_caseType_idx" ON "case_status_transitions"("caseId", "caseType");

-- CreateIndex
CREATE INDEX "case_status_transitions_actorType_actorId_idx" ON "case_status_transitions"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "case_status_transitions_toStatus_idx" ON "case_status_transitions"("toStatus");

-- CreateIndex
CREATE INDEX "case_status_transitions_createdAt_idx" ON "case_status_transitions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "matches_matchNumber_key" ON "matches"("matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "matches_aiInteractionId_key" ON "matches"("aiInteractionId");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "matches_lostDocumentCaseId_foundDocumentCaseId_key" ON "matches"("lostDocumentCaseId", "foundDocumentCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "claims_claimNumber_key" ON "claims"("claimNumber");

-- CreateIndex
CREATE INDEX "claims_userId_idx" ON "claims"("userId");

-- CreateIndex
CREATE INDEX "claims_foundDocumentCaseId_idx" ON "claims"("foundDocumentCaseId");

-- CreateIndex
CREATE INDEX "claims_matchId_idx" ON "claims"("matchId");

-- CreateIndex
CREATE INDEX "claims_status_idx" ON "claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "claim_verifications_claimId_key" ON "claim_verifications"("claimId");

-- CreateIndex
CREATE INDEX "claim_verifications_claimId_idx" ON "claim_verifications"("claimId");

-- CreateIndex
CREATE INDEX "ai_interactions_userId_idx" ON "ai_interactions"("userId");

-- CreateIndex
CREATE INDEX "ai_interactions_interactionType_idx" ON "ai_interactions"("interactionType");

-- CreateIndex
CREATE INDEX "ai_interactions_entityType_entityId_idx" ON "ai_interactions"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ai_interactions_createdAt_idx" ON "ai_interactions"("createdAt");

-- CreateIndex
CREATE INDEX "ai_interactions_success_idx" ON "ai_interactions"("success");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_stations_code_key" ON "pickup_stations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "handovers_handoverNumber_key" ON "handovers"("handoverNumber");

-- CreateIndex
CREATE UNIQUE INDEX "handovers_claimId_key" ON "handovers"("claimId");

-- CreateIndex
CREATE INDEX "handovers_claimId_idx" ON "handovers"("claimId");

-- CreateIndex
CREATE INDEX "handovers_status_idx" ON "handovers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transactionNumber_key" ON "transactions"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_claimId_key" ON "transactions"("claimId");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_claimId_idx" ON "transactions"("claimId");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "ratings_raterId_idx" ON "ratings"("raterId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_disputeNumber_key" ON "disputes"("disputeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_claimId_key" ON "disputes"("claimId");

-- CreateIndex
CREATE INDEX "disputes_claimId_idx" ON "disputes"("claimId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "conversations_participants_idx" ON "conversations"("participants");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "address_locales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_hierarchy" ADD CONSTRAINT "address_hierarchy_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "address_hierarchy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_fields" ADD CONSTRAINT "document_fields_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_images" ADD CONSTRAINT "document_images_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extraction_interactions" ADD CONSTRAINT "ai_extraction_interactions_aiInteractionId_fkey" FOREIGN KEY ("aiInteractionId") REFERENCES "ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extraction_interactions" ADD CONSTRAINT "ai_extraction_interactions_aiExtractionId_fkey" FOREIGN KEY ("aiExtractionId") REFERENCES "ai_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_cases" ADD CONSTRAINT "document_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_cases" ADD CONSTRAINT "document_cases_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_cases" ADD CONSTRAINT "document_cases_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "ai_extractions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_document_cases" ADD CONSTRAINT "lost_document_cases_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_document_cases" ADD CONSTRAINT "found_document_cases_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_document_cases" ADD CONSTRAINT "found_document_cases_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_transitions" ADD CONSTRAINT "case_status_transitions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_aiInteractionId_fkey" FOREIGN KEY ("aiInteractionId") REFERENCES "ai_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_lostDocumentCaseId_fkey" FOREIGN KEY ("lostDocumentCaseId") REFERENCES "lost_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_foundDocumentCaseId_fkey" FOREIGN KEY ("foundDocumentCaseId") REFERENCES "found_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_foundDocumentCaseId_fkey" FOREIGN KEY ("foundDocumentCaseId") REFERENCES "found_document_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_attachments" ADD CONSTRAINT "claim_attachments_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_attachments" ADD CONSTRAINT "claim_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_verifications" ADD CONSTRAINT "claim_verifications_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_stations" ADD CONSTRAINT "pickup_stations_addressLocaleCode_fkey" FOREIGN KEY ("addressLocaleCode") REFERENCES "address_locales"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_pickupStationId_fkey" FOREIGN KEY ("pickupStationId") REFERENCES "pickup_stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_documentCaseId_fkey" FOREIGN KEY ("documentCaseId") REFERENCES "document_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_initiatedBy_fkey" FOREIGN KEY ("initiatedBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
