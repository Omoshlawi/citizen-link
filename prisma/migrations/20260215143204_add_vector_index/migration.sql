-- Force the column to have fixed 768 dimensions
ALTER TABLE "documents" 
ALTER COLUMN embedding TYPE vector(768);

CREATE INDEX document_embedding_idx ON "documents" USING hnsw (embedding vector_cosine_ops);