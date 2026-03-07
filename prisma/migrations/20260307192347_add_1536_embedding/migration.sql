-- Add a 1536-dim column for OpenAI text-embedding-3-small
ALTER TABLE "documents"
ADD COLUMN embedding_1536 VECTOR(1536);