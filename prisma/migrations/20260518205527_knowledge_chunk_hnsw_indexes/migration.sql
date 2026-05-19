-- HNSW vector indexes for knowledge_chunks — mirrors the document table indexes.
-- HNSW (Hierarchical Navigable Small World) is the fastest index type for
-- approximate nearest-neighbour search in pgvector.
-- vector_cosine_ops = cosine distance (same operator <=> used in matching queries).

CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_768_idx
  ON knowledge_chunks USING hnsw (embedding_768 vector_cosine_ops);

CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_1536_idx
  ON knowledge_chunks USING hnsw (embedding_1536 vector_cosine_ops);