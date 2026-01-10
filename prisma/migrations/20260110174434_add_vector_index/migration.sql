-- migrations/XXXXXX_add_vector_index/migration.sql
-- Create IVFFlat index for faster similarity searches
-- Lists parameter should be roughly sqrt of expected number of rows
-- Start with 100, adjust based on your data volume
CREATE INDEX document_embedding_idx ON "Document" 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);