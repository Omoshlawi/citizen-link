-- Force fixed dimension (avoids "column does not have dimensions" error)
ALTER TABLE "documents"
  ALTER COLUMN embedding_ada TYPE vector(1536);

-- HNSW index using cosine similarity
CREATE INDEX document_embedding_ada_idx ON "documents"
  USING hnsw (embedding_ada vector_cosine_ops);