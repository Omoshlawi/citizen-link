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

ALTER TABLE "Document"
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

**Optional but recomended steps**

6. Create Vector Index migration

```bash
migrate dev --create-only --name add_vector_index
```

7. Paste bellow sql commands

```sql

-- migrations/XXXXXX_add_vector_index/migration.sql
-- Create IVFFlat index for faster similarity searches
-- Lists parameter should be roughly sqrt of expected number of rows
-- Start with 100, adjust based on your data volume
CREATE INDEX document_embedding_idx ON "Document"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

```

8. Apply migration

```bash
pnpm db migrate dev
```
