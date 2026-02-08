CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Document"
-- Creates a vector column sized for models like
-- OpenAI text-embedding-3-small (768)
-- Many sentence-transformer models
ADD COLUMN embedding VECTOR(768);