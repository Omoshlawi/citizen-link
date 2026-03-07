-- This is an empty migration.
-- Add a 1536-dim column for OpenAI text-embedding-ada-002-v2
ALTER TABLE "documents"
ADD COLUMN embedding_ada VECTOR(1536);