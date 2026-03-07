# Dual Embedding Vector Support

> Adding `text-embedding-3-small` (1536-dim) alongside `nomic-embed-text` (768-dim)

| Model                             | Dimensions | Column          |
| --------------------------------- | ---------- | --------------- |
| nomic-embed-text _(existing)_     | 768        | `embedding_768`     |
| text-embedding-3-small _(new)_ | 1536       | `embedding_1536` |

---

## Step 1 — Add the New Column via Prisma Migration

Create a migration file without running it immediately:

```bash
pnpm db migrate dev --name add-1536-embedding --create-only
```

Paste the following SQL into the generated empty migration file:

```sql
-- Add a 1536-dim column for OpenAI text-embedding-3-small
ALTER TABLE "documents"
ADD COLUMN embedding_1536 VECTOR(1536);
```

> **Note:** The existing `embedding` column (768-dim) is untouched. Both columns live on the same table.

Apply the migration:

```bash
pnpm db migrate deploy
```

---

## Step 2 — Update the Prisma Schema

Pull the new column into your schema automatically:

```bash
pnpm db db pull
```

Or add it manually — both produce the same schema entry:

```prisma
// schema.prisma — documents model
model documents {
  // ... existing fields ...
  embedding_768      Unsupported("vector")?   // existing 768-dim
  embedding_1536  Unsupported("vector")?   // new 1536-dim
}
```

---

## Step 3 — Add a Vector Index for the New Column

Create a dedicated migration for the index:

```bash
pnpm db migrate dev --create-only --name add_1536_vector_index
```

### Option A — HNSW (recommended)

Works on an empty table; no pre-existing data required. Best query-speed / recall trade-off.

```sql
-- Force fixed dimension (avoids "column does not have dimensions" error)
ALTER TABLE "documents"
  ALTER COLUMN embedding_1536 TYPE vector(1536);

-- HNSW index using cosine similarity
CREATE INDEX document_embedding_1536_idx ON "documents"
  USING hnsw (embedding_1536 vector_cosine_ops);
```

### Option B — IVFFlat (lower memory, needs 1 000+ rows first)

> **Warning:** Build this index only after inserting at least 1 000 rows. An empty table produces 0 centroids and the index will be ineffective.

```sql
ALTER TABLE "documents"
  ALTER COLUMN embedding_1536 TYPE vector(1536);

CREATE INDEX document_embedding_1536_idx ON "documents"
  USING ivfflat (embedding_1536 vector_cosine_ops)
  WITH (lists = 100);
```

Apply the migration:

```bash
pnpm db migrate deploy
```

---

## Troubleshooting

### "column does not have dimensions"

The column was created as a generic vector. Cast it to the fixed size before building the index:

```sql
ALTER TABLE "documents"
  ALTER COLUMN embedding_1536 TYPE vector(1536);
```

Then retry the index creation. Adding the `ALTER` before the `CREATE INDEX` in the same migration file runs both together automatically.

### Dimension mismatch at query time

Add a guard at the service boundary to catch mismatches early:

```typescript
const cfg = EMBEDDING_CONFIGS[params.model ?? 'NOMIC'];
if (params.embeddingVector.length !== cfg.dimension) {
  throw new Error(
    `Vector length ${params.embeddingVector.length} does not match ` +
      `expected ${cfg.dimension} for model ${params.model}`,
  );
}
```

### IVFFlat empty-table failure

If you see clustering errors, the table lacks sufficient data. Switch to HNSW or load at least 1 000 rows before creating the IVFFlat index.

---

## Quick Reference

| Topic               | Detail                                     |
| ------------------- | ------------------------------------------ |
| New column          | `embedding_1536 VECTOR(1536)`               |
| Index type          | HNSW (preferred) or IVFFlat                |
| Model key           | `'ADA_002'` — `'NOMIC'` is the default     |
| Backwards compat    | Omit `model` param → NOMIC column used     |
| Dimension guard     | Validate `vector.length === cfg.dimension` |
| OpenAI model string | `'text-embedding-ada-002'`                 |
