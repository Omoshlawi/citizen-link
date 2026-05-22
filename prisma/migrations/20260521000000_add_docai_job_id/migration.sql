-- Add docaiJobId to AIExtraction so webhooks from docai can be looked up
-- without passing NestJS internal IDs to the external service.
ALTER TABLE "ai_extractions" ADD COLUMN "docaiJobId" TEXT;
CREATE UNIQUE INDEX "ai_extractions_docaiJobId_key" ON "ai_extractions"("docaiJobId");
