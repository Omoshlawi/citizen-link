## Vector support

- To support vector type for sematic search , bellow are steps since the type aint supported natively in postgresql

1. Install postgresql image thats support vector preferably `pgvector/pgvector:0.8.1-pg18-trixie`,

```bash
docker run -d \
  -e POSTGRES_USER=pguser \
  -e POSTGRES_PASSWORD=pgpassword \
  pgvector/pgvector:0.8.1-pg18-trixie
```

2. Create prisma migration file

```bash
pnpm db migrate dev --name add-pgvector --create-only
```

3. In th empty migration file created, paste

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "documents"
-- Creates a vector column sized for models like
-- OpenAI text-embedding-3-small (768)
-- Many sentence-transformer models
ADD COLUMN embedding VECTOR(768);

```

In this case, you:

- you've install the `pgvector` extension in your database using the `CREATE EXTENSION` statement
- update table `Document` table schema to include embedings field that uses the `VECTOR` type from that extension

4. Execute the migration against the db

```bash
pnpm db migrate deploy
```

5. Pull the document table into your Prisma schema

```bash
pnpm db db pull
```

instead of pulling via step 5, you can add the embedding field mannually to the schema file, The introspection simply adds the fields to the schema

```prisma
embedding    Unsupported("vector")?
```

**Optional but recomended steps(indexing for perfomance)**

## IVFFlat Index

This index works best when the table already has data. If your table is empty, the index will have 0 centroids and won't be effective. It is often recommended to load at least 1,000+ rows before building an ivfflat index.
IVFFlat requires a training step to create clusters (lists) hence need of data in the table.

If the table is empty, the indexer cannot perform the k-means clustering needed to initialize the index structure, and it fails to identify the dimension constraint from the "empty" space.

If you specifically need IVFFlat (e.g., due to lower memory usage), you must have data in the table first.

1. Comment out the index creation in your migration.
2. Insert your data (at least 1,000 rows are recommended for the lists = 100 parameter to be effective).
3. Run the index creation after the data is loaded.

Why IVFFLAT fails when there is no data in table

- Training Requirement: IVFFlat uses k-means to partition vectors into "lists." With zero rows, it cannot create these partitions.

Create Vector Index migration

```bash
pnpm db migrate dev --create-only --name add_vector_index
```

7. Paste bellow sql commands

```sql

-- migrations/XXXXXX_add_vector_index/migration.sql
-- Create IVFFlat index for faster similarity searches
-- Lists parameter should be roughly sqrt of expected number of rows
-- Start with 100, adjust based on your data volume
CREATE INDEX document_embedding_idx ON "documents"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

```

If your table is large, the standard index build might time out or hit memory locks. Try creating it concurrently to avoid blocking other operations:

```sql
CREATE INDEX CONCURRENTLY document_embedding_idx
ON "documents" USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

Apply migration

```bash
pnpm db migrate dev
```

## HNSW or Wait index

For most modern applications, HNSW is the preferred index type because it handles empty starts gracefully and maintains high accuracy without frequent reindexing.

Unlike IVFFlat, the HNSW (Hierarchical Navigable Small Worlds) index does not require a training step. It can be created on an empty table and will automatically update as you add data.

- `Performance`: Generally offers better query speed/recall trade-off than IVFFlat.
- `Migration`: Replace your index SQL with this:

```sql
CREATE INDEX document_embedding_idx ON "documents"
USING hnsw (embedding vector_cosine_ops);
```
