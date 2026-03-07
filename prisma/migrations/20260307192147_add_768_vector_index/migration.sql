-- Force the column to have fixed 768 dimensions
ALTER TABLE "documents" 
ALTER COLUMN embedding_768 TYPE vector(768);
-- Create the index
CREATE INDEX document_embedding_idx ON "documents" USING hnsw (embedding_768 vector_cosine_ops);