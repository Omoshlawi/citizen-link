# Qdrant Migration Guide

Future migration path from pgvector to Qdrant for the CitizenLink document-matching pipeline and knowledge base.

---

## Table of Contents

1. [What Is Qdrant?](#what-is-qdrant)
2. [Why Migrate?](#why-migrate)
3. [Current Architecture (pgvector)](#current-architecture-pgvector)
4. [Proposed Architecture (Qdrant)](#proposed-architecture-qdrant)
5. [Hybrid Search — Dense + Sparse](#hybrid-search--dense--sparse)
6. [Collection Design](#collection-design)
7. [Migration Steps](#migration-steps)
8. [NestJS Service Changes](#nestjs-service-changes)
9. [Docker Compose](#docker-compose)
10. [Environment Variables](#environment-variables)
11. [Performance Tuning](#performance-tuning)
12. [Rollback Plan](#rollback-plan)
13. [Knowledge Base Migration (Future)](#knowledge-base-migration-future)

---

## What Is Qdrant?

Qdrant (pronounced _quad-rant_) is a purpose-built vector database and similarity search engine. It is written entirely in **Rust** and designed from the ground up for high-throughput, low-latency nearest-neighbour search over dense and sparse vectors.

Unlike pgvector, which is a PostgreSQL extension bolted onto a relational engine, Qdrant is a **dedicated vector store** — its entire storage, indexing, and query engine is optimised for one job: finding the most similar vectors to a query as fast as possible, at any scale.

Official docs: https://qdrant.tech/documentation  
GitHub: https://github.com/qdrant/qdrant  
NestJS client: `@qdrant/js-client-rest` / `@qdrant/js-client-grpc`

---

## Why Migrate?

### 1. Rust — Speed and a Tiny Footprint

Qdrant is written in Rust, a systems-level language that compiles to a **single native binary with no runtime**. This has cascading benefits:

| Factor | pgvector (PostgreSQL) | Qdrant |
|---|---|---|
| Runtime overhead | Full Postgres process, query planner, WAL, vacuum | None — single native binary |
| Cold-start time | Several seconds | Under 200 ms |
| Base memory (idle) | ~100–300 MB | ~20–40 MB |
| Binary size | N/A (shared library) | ~30 MB static binary |

Because Rust compiles to machine code with no garbage collector and no interpreter, Qdrant has **deterministic, low-latency** responses even under load — there are no GC pause spikes like you would get with a Java or Go-based database.

### 2. Dedicated Index — HNSW with Quantization

pgvector supports HNSW (Hierarchical Navigable Small World) since v0.5, but it is an add-on to a general-purpose database. Qdrant's HNSW implementation is its primary data structure, hand-tuned in Rust with:

- **Scalar quantization (SQ8)** — compresses each float32 to int8, reducing memory by 4× with ~1% recall loss.
- **Product quantization (PQ)** — compresses by 8–32×, useful when RAM is the bottleneck.
- **Binary quantization** — the most aggressive compression; good for high-dimensional models (1536-dim OpenAI).
- **On-disk HNSW** — graphs larger than RAM are memory-mapped via `mmap`. Only hot segments stay in RAM.

With 1536-dimension OpenAI embeddings, a collection of 1 million documents takes ~6 GB as raw float32. With SQ8 quantization the same collection fits in ~1.5 GB — in RAM — while the binary still serves accurate results.

pgvector stores vectors as raw `float4[]` columns in PostgreSQL heap pages. There is no quantization support.

### 3. Hybrid Search — Dense + Sparse (This is the Big One)

The current matching pipeline uses **dense-only** vector search. Dense embeddings capture semantic similarity well but miss on exact field matches — a document number `A12345678` typed slightly differently by OCR (`A12345 78`) produces a very different token, which a dense model may not reliably bridge.

Qdrant natively supports **hybrid search** by combining:

#### Dense vectors
Neural embeddings (OpenAI `text-embedding-3-small` or Nomic `nomic-embed-text`) that encode semantic meaning into a continuous high-dimensional space. Good for: synonym matching, paraphrased names, OCR-fuzzy text.

#### Sparse vectors
Term-frequency-based representations (BM25, SPLADE, or a custom TF-IDF). Each dimension corresponds to a vocabulary token. Only non-zero dimensions are stored. Good for: exact document number matches, precise name matching, document type codes.

Qdrant fuses the two scores with **Reciprocal Rank Fusion (RRF)** or a configurable linear combination:

```
final_score = α × dense_score + (1 − α) × sparse_score
```

For CitizenLink this means:
- A lost passport with name `John Mwangi` and number `A12345678` will match the found case even if OCR read the name as `Jon Mwangi` (dense handles this) **and** the document number is present verbatim (sparse gives it a boost).
- Pure dense search sometimes ranks semantically similar but unrelated documents above an exact-number match. Hybrid eliminates this failure mode.

### 4. Payload Filtering — Pre-filter, Not Post-filter

The current pgvector queries filter by `typeId`, `status`, and `userId` using SQL `WHERE` clauses **after** the vector scan. This means Postgres may scan many irrelevant vectors before filtering down to the real candidates.

Qdrant indexes payload fields and applies filters **inside the HNSW graph traversal** — it only visits nodes that pass the filter. For a collection with 20 document types, this means the effective search space is ~1/20th of the full collection on every query.

```
// current pgvector approach — post-filter (scans all, then discards)
WHERE d.embedding_1536 IS NOT NULL
  AND d."typeId" = $2          ← applied after vector scan
  AND fdc.status = 'VERIFIED'  ← applied after vector scan

// qdrant approach — pre-filter (never visits non-matching nodes)
filter: {
  must: [
    { key: 'typeId',   match: { value: typeId } },
    { key: 'status',   match: { value: 'VERIFIED' } },
    { key: 'userId',   match: { value: { any: [...] }, except: [excludedUserId] } },
  ]
}
```

### 5. Named Vectors — Multiple Embedding Spaces Per Document

Qdrant allows a single point (document) to carry **multiple named vectors**:

```json
{
  "id": "doc-uuid",
  "vector": {
    "dense":  [0.12, -0.03, ...],   // OpenAI / Nomic dense embedding
    "sparse": { "indices": [42, 1007, ...], "values": [0.8, 0.4, ...] }
  },
  "payload": { "typeId": "...", "status": "VERIFIED", ... }
}
```

This means:
- No schema change when adding a new embedding model
- A/B testing two models in parallel without duplicating data
- Incremental migration: dense-only search works immediately; sparse vectors can be back-filled

### 6. No Transactional Overhead

Every vector write in PostgreSQL goes through WAL (Write-Ahead Log), MVCC, and the autovacuum pipeline. For an append-mostly workload like document indexing, this is unnecessary overhead. Qdrant's storage engine is purpose-built for vectors — upserts are lock-free, and the storage format is optimised for sequential reads during HNSW construction.

### 7. gRPC Interface

Qdrant exposes both REST and gRPC. For high-throughput batch indexing (the `batchIndexDocuments` path), switching to gRPC reduces per-request latency by eliminating HTTP/JSON overhead. The `@qdrant/js-client-grpc` package wraps the gRPC interface in a TypeScript-friendly API.

### 8. Snapshots and Backups

Qdrant has a built-in snapshot API:
```
POST /collections/documents/snapshots
```
This creates a portable `.snapshot` file of the entire collection — HNSW graph, vectors, and payloads — that can be restored to any Qdrant instance. pgvector backups require `pg_dump` of the entire database.

### 9. Scroll API for Full Iteration

The current `batchIndexDocuments` method processes documents from PostgreSQL. Qdrant's Scroll API allows iterating the entire collection page by page without a LIMIT/OFFSET performance cliff — useful for re-indexing, audits, or backfills.

---

## Current Architecture (pgvector)

```
Document written to DB
        │
        ▼
EmbeddingService.embeddDocument()
        │
        ▼
OpenAI / Nomic → float[] (1536 or 768 dims)
        │
        ▼
$executeRawUnsafe:
  UPDATE "documents" SET embedding_1536 = $1::vector WHERE id = $2
        │
        ▼
PostgreSQL heap column: embedding_1536 vector(1536)
        │
        ▼
MatchingQueryService.findFoundCandidates() / findLostCandidates()
  → $queryRawUnsafe with <=> cosine distance operator
  → SQL WHERE filters applied post-scan
```

**Limitations:**
- Vectors stored in the same table as the business data — every vector update touches the documents heap
- No sparse search, no hybrid scoring
- `$queryRawUnsafe` is fragile (dimension suffix in column name, string interpolation)
- Post-filter means scanning all vectors before applying `typeId` / `status` filters
- `embedding_1536` and `embedding_768` are separate nullable columns — adding a third model requires a migration

---

## Proposed Architecture (Qdrant)

```
Document written to DB (PostgreSQL — no vector column)
        │
        ▼
EmbeddingService.embeddDocument()
        │
        ├─── dense: OpenAI / Nomic → float[]
        │
        └─── sparse: BM25 / SPLADE → { indices[], values[] }
                │
                ▼
        QdrantService.upsertPoint({
          id: documentId,
          vector: { dense: [...], sparse: { indices, values } },
          payload: { typeId, status, caseId, userId, caseType }
        })
                │
                ▼
        Qdrant collection: "documents"
                │
                ▼
        MatchingQueryService (Qdrant)
          → hybrid search: dense + sparse + payload pre-filter
          → returns scored candidates with caseId for Prisma lookup
```

PostgreSQL continues to own all **business data** (case records, claims, users, etc.). Qdrant owns **only vectors and their payloads** (a flat copy of the fields needed for filtering). The `documentId` is the primary key linking the two.

---

## Hybrid Search — Dense + Sparse

### Sparse Vector Generation

For the sparse component, two options:

#### Option A — BM25 (simple, no GPU required)
Run a BM25 tokeniser over the document text produced by `createDocumentText()`. The `@qdrant/fastembed` package ships a WASM BM25 encoder that runs in Node.js with no external dependencies.

```typescript
import { SparseTextEmbedding } from '@xenova/transformers'; // or fastembed

const model = await SparseTextEmbedding.init('Qdrant/bm25');
const sparse = await model.embed(documentText);
// → { indices: number[], values: number[] }
```

#### Option B — SPLADE (higher recall, GPU recommended for generation)
SPLADE (SParse Lexical AnD Expansion) is a learned sparse model that expands query terms to synonyms. Significantly better recall than BM25 but requires running a transformer inference step. Suitable if a GPU or a dedicated inference sidecar is available.

For CitizenLink, **Option A (BM25)** is the right starting point — it runs entirely in Node.js, adds no infrastructure, and meaningfully improves exact-field match recall (document numbers, national ID numbers, names).

### Fusion Strategy

Qdrant's `query` endpoint handles fusion natively:

```typescript
const results = await qdrant.query('documents', {
  prefetch: [
    { query: { indices, values }, using: 'sparse', limit: 50 },
    { query: denseVector,          using: 'dense',  limit: 50 },
  ],
  query: { fusion: 'rrf' },  // Reciprocal Rank Fusion
  filter: {
    must: [
      { key: 'typeId', match: { value: typeId } },
      { key: 'status', match: { value: 'VERIFIED' } },
    ],
    must_not: [
      { key: 'documentId', match: { value: excludeDocumentId } },
      { key: 'userId',     match: { value: excludeUserId } },
    ],
  },
  limit,
  with_payload: ['caseId', 'documentId'],
});
```

RRF combines rankings from the dense and sparse passes without needing score normalisation — it is robust to the fact that cosine similarity and BM25 scores are on different scales.

---

## Collection Design

### Collection: `documents`

```typescript
await qdrant.createCollection('documents', {
  vectors: {
    dense: {
      size: 1536,            // or 768 for Nomic
      distance: 'Cosine',
      on_disk: false,        // keep in RAM for sub-10ms P99
      hnsw_config: {
        m: 16,               // edges per node — higher = better recall, more RAM
        ef_construction: 200 // build-time beam width — higher = better graph quality
      },
    },
  },
  sparse_vectors: {
    sparse: {
      index: { full_scan_threshold: 5000 },
    },
  },
  quantization_config: {
    scalar: {
      type: 'int8',
      quantile: 0.99,
      always_ram: true,      // keep quantized vectors in RAM
    },
  },
  optimizers_config: {
    indexing_threshold: 20000,  // build HNSW after 20k points
    memmap_threshold: 50000,    // mmap segments beyond 50k points
  },
});
```

### Payload Schema (indexed fields)

```typescript
// Create payload indexes for fast pre-filtering
await qdrant.createPayloadIndex('documents', {
  field_name: 'typeId',
  field_schema: 'keyword',
});

await qdrant.createPayloadIndex('documents', {
  field_name: 'status',
  field_schema: 'keyword',
});

await qdrant.createPayloadIndex('documents', {
  field_name: 'userId',
  field_schema: 'keyword',
});

await qdrant.createPayloadIndex('documents', {
  field_name: 'caseType',         // 'LOST' | 'FOUND'
  field_schema: 'keyword',
});
```

### Point Structure

```typescript
interface DocumentPoint {
  id: string;                   // documentId (UUID — Qdrant accepts UUID strings natively)
  vector: {
    dense: number[];
    sparse: { indices: number[]; values: number[] };
  };
  payload: {
    documentId: string;
    caseId: string;
    typeId: string;
    userId: string;
    status: string;             // 'VERIFIED' | 'SUBMITTED' etc.
    caseType: 'LOST' | 'FOUND';
  };
}
```

---

## Migration Steps

### Phase 1 — Infrastructure

1. Add Qdrant to `docker-compose.dev.yml` (see [Docker Compose](#docker-compose) section)
2. Install the client:
   ```bash
   pnpm add @qdrant/js-client-rest
   ```
3. Create `src/qdrant/qdrant.module.ts`, `qdrant.service.ts`, `qdrant.config.ts`
4. Create the `documents` collection and payload indexes on startup (idempotent)

### Phase 2 — Dual-Write

Update `EmbeddingService.embeddDocument()` to write to **both** pgvector and Qdrant. This gives zero-risk validation — the Qdrant writes can fail silently without breaking production, and you can compare result sets.

```typescript
// Write to Postgres (existing)
await this.prisma.$executeRawUnsafe(`UPDATE "documents" SET embedding_${dims} = $1::vector ...`);

// Write to Qdrant (new, non-blocking)
this.qdrantService.upsertPoint(documentId, denseEmbedding, sparseVector, payload)
  .catch(err => this.logger.warn('Qdrant write failed (non-fatal)', err));
```

### Phase 3 — Backfill

Re-index all existing documents into Qdrant using `batchIndexDocuments` with the new code path:

```bash
# One-time backfill script
pnpm ts-node scripts/backfill-qdrant.ts
```

The backfill script queries all documents from Prisma in pages of 500, generates embeddings (if not cached), and upserts into Qdrant.

### Phase 4 — Shadow Traffic

Run `MatchingVectorSearchService` against both backends simultaneously. Log result sets and compare:
- Hit rate differences (cases found by Qdrant but missed by pgvector)
- Score distributions
- Query latency

### Phase 5 — Cutover

1. Update `MatchingQueryService` to query Qdrant exclusively
2. Remove the pgvector path from `EmbeddingService.embeddDocument()`
3. Drop `embedding_1536` and `embedding_768` columns from the `documents` table via Prisma migration

### Phase 6 — Cleanup

1. Remove `pgvector` extension from `schema.prisma` and migration files
2. Remove `$queryRawUnsafe` calls from `matching.query.service.ts`
3. Remove `$executeRawUnsafe` from `embedding.service.ts`

---

## NestJS Service Changes

### `src/qdrant/qdrant.service.ts` (new)

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION = 'documents';

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;

  constructor(private readonly config: QdrantConfig) {
    this.client = new QdrantClient({ url: config.url, apiKey: config.apiKey });
  }

  async onModuleInit() {
    await this.ensureCollection();
  }

  async upsertPoint(
    documentId: string,
    dense: number[],
    sparse: { indices: number[]; values: number[] },
    payload: Record<string, unknown>,
  ) {
    await this.client.upsert(COLLECTION, {
      wait: false,   // async write — returns immediately
      points: [{
        id: documentId,
        vector: { dense, sparse },
        payload,
      }],
    });
  }

  async searchHybrid(params: {
    dense: number[];
    sparse: { indices: number[]; values: number[] };
    typeId: string;
    status: string;
    excludeUserId: string;
    excludeDocumentId: string;
    limit: number;
    scoreThreshold: number;
  }) {
    return this.client.query(COLLECTION, {
      prefetch: [
        { query: params.sparse, using: 'sparse', limit: params.limit * 5 },
        { query: params.dense,  using: 'dense',  limit: params.limit * 5 },
      ],
      query: { fusion: 'rrf' },
      filter: {
        must: [
          { key: 'typeId', match: { value: params.typeId } },
          { key: 'status', match: { value: params.status } },
        ],
        must_not: [
          { key: 'documentId', match: { value: params.excludeDocumentId } },
          { key: 'userId',     match: { value: params.excludeUserId } },
        ],
      },
      score_threshold: params.scoreThreshold,
      limit: params.limit,
      with_payload: ['caseId', 'documentId'],
    });
  }

  async deletePoint(documentId: string) {
    await this.client.delete(COLLECTION, {
      wait: false,
      points: [documentId],
    });
  }

  private async ensureCollection() {
    const exists = await this.client.collectionExists(COLLECTION);
    if (exists.exists) return;

    this.logger.log(`Creating Qdrant collection: ${COLLECTION}`);
    await this.client.createCollection(COLLECTION, {
      vectors: {
        dense: { size: 1536, distance: 'Cosine' },
      },
      sparse_vectors: {
        sparse: { index: { full_scan_threshold: 5000 } },
      },
      quantization_config: {
        scalar: { type: 'int8', quantile: 0.99, always_ram: true },
      },
    });

    for (const field of ['typeId', 'status', 'userId', 'caseType']) {
      await this.client.createPayloadIndex(COLLECTION, {
        field_name: field,
        field_schema: 'keyword',
      });
    }
  }
}
```

### `embedding.service.ts` — `embeddDocument()` changes

```typescript
// Replace the raw SQL update with a Qdrant upsert
async embeddDocument(documentId: string): Promise<void> {
  const document = await this.prisma.document.findUnique({ ... });
  const text = this.createDocumentText(document);
  const dense = await lastValueFrom(this.generateEmbedding(text, 'document'));
  const sparse = await this.sparseEncoder.embed(text);  // BM25

  await this.qdrantService.upsertPoint(
    documentId,
    dense,
    sparse,
    {
      documentId: document.id,
      caseId: document.caseId,
      typeId: document.typeId,
      userId: document.case.userId,
      status: document.case.foundDocumentCase?.status
           ?? document.case.lostDocumentCase?.status
           ?? 'UNKNOWN',
      caseType: document.case.foundDocumentCase ? 'FOUND' : 'LOST',
    },
  );
}
```

### `matching.query.service.ts` — replace raw SQL

```typescript
// Replace $queryRawUnsafe with QdrantService.searchHybrid()
async findFoundCandidates(params: VectorSearchParams): Promise<CandidateMatch[]> {
  const sparse = await this.sparseEncoder.embed(params.text);

  const results = await this.qdrantService.searchHybrid({
    dense: params.embeddingVector,
    sparse,
    typeId: params.typeId,
    status: 'VERIFIED',
    excludeUserId: params.excludeUserId,
    excludeDocumentId: params.excludeDocumentId,
    limit: params.topN,
    scoreThreshold: params.similarityThreshold,
  });

  return results.points.map(p => ({
    documentId: p.payload!.documentId as string,
    caseId: p.payload!.caseId as string,
    similarity: p.score,
  }));
}
```

---

## Docker Compose

Add to `docker-compose.dev.yml`:

```yaml
qdrant:
  image: qdrant/qdrant:v1.13.6
  container_name: citizenlink_qdrant
  ports:
    - "6333:6333"   # REST API
    - "6334:6334"   # gRPC
  volumes:
    - qdrant_storage:/qdrant/storage
  environment:
    QDRANT__SERVICE__API_KEY: ${QDRANT_API_KEY:-}
    QDRANT__LOG_LEVEL: INFO
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
    interval: 10s
    timeout: 5s
    retries: 5

volumes:
  qdrant_storage:
```

The Qdrant Docker image is **~80 MB**. Startup time is under 500 ms. The REST UI dashboard is available at `http://localhost:6333/dashboard`.

---

## Environment Variables

Add to `.env`:

```env
# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=                  # leave blank for local dev; set in production
QDRANT_COLLECTION=documents
```

Add to `src/qdrant/qdrant.config.ts`:

```typescript
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  url:        z.string().url(),
  apiKey:     z.string().optional(),
  collection: z.string().default('documents'),
});

export default registerAs('qdrant', () =>
  schema.parse({
    url:        process.env.QDRANT_URL ?? 'http://localhost:6333',
    apiKey:     process.env.QDRANT_API_KEY,
    collection: process.env.QDRANT_COLLECTION ?? 'documents',
  }),
);
```

---

## Performance Tuning

### HNSW Parameters

| Parameter | Default | Recommendation | Notes |
|---|---|---|---|
| `m` | 16 | 16–32 | Edges per node. Higher = better recall, more RAM and build time |
| `ef_construction` | 100 | 200 | Beam width during graph build. Higher = better graph quality |
| `ef` (query) | auto | 128–256 | Beam width during search. Set via collection params |

For a collection under ~500k documents, the defaults are fine. Tune `ef` upward if recall is below 95% (measurable via the Qdrant benchmark tool).

### Quantization

Start with `scalar` (int8). It compresses each `float32` to one byte — 4× reduction. Accuracy loss is typically under 1% on cosine similarity tasks with `quantile: 0.99`.

For a 1536-dimension OpenAI collection:
- Raw float32: 1M docs × 1536 × 4 bytes = ~6 GB RAM
- int8 quantization: ~1.5 GB RAM

Binary quantization (1 bit per dimension) gives 32× compression with ~5% recall loss — acceptable if the re-scoring step (`rescore: true`) is enabled, which re-ranks with the original float32 values.

### Write Performance

`wait: false` on upserts means Qdrant acknowledges the write and applies it asynchronously. For the indexing pipeline this is correct — use `wait: true` only in tests.

For bulk backfill, batch upserts of 256–512 points per request give optimal throughput:

```typescript
for (let i = 0; i < points.length; i += 512) {
  await client.upsert(collection, {
    wait: false,
    points: points.slice(i, i + 512),
  });
}
```

### gRPC (optional)

Switch from REST to gRPC for high-throughput paths (batch indexing):

```typescript
import { QdrantClient } from '@qdrant/js-client-grpc';
// identical API surface — just different transport
```

gRPC removes JSON serialisation overhead and uses HTTP/2 multiplexing. Expect 20–40% lower latency per request on batch operations.

---

## Rollback Plan

Because Phase 2 is a dual-write and the pgvector columns are not dropped until Phase 6, rollback at any phase is:

1. **Phase 2–4**: Stop writing to Qdrant — revert the `upsertPoint` call. pgvector data is fully intact.
2. **Phase 5**: Restore `MatchingQueryService` to the raw SQL path. pgvector data is intact.
3. **Phase 6** (irreversible): Once columns are dropped and pgvector is removed, rollback requires restoring from a database snapshot. Do not proceed to Phase 6 until Phase 4 shadow traffic analysis is complete and result parity is confirmed.

---

## Knowledge Base Migration (Future)

The CitizenLink knowledge base (citizen guidance, FAQs, policy content — not yet complete) will also be migrated to Qdrant when it is built out, running as a **second collection** in the same Qdrant instance alongside `documents`.

### Why the Knowledge Base Belongs in Qdrant Too

The knowledge base use case is retrieval-augmented generation (RAG) — a citizen asks a question in natural language and the system retrieves the most relevant knowledge chunks to ground an LLM response. This is a **pure vector workload**: no relational joins, no transactional writes, no foreign keys. Keeping it in pgvector would be the same mistake twice.

Additionally, knowledge base queries are typically:
- **Multi-lingual** — content may exist in English and Swahili; a single dense model that handles both is preferable to separate columns
- **Namespace-scoped** — different content categories (legal, process, FAQ) should be filterable without scanning the whole collection
- **High read, low write** — content is edited infrequently; Qdrant's optimised read path is ideal

### Collection: `knowledge_base`

A separate collection keeps the two workloads isolated. Schema differences from `documents`:

```typescript
await qdrant.createCollection('knowledge_base', {
  vectors: {
    dense: {
      size: 1536,          // or 768 — match whichever model is used for KB embeddings
      distance: 'Cosine',
    },
  },
  sparse_vectors: {
    sparse: {
      index: { full_scan_threshold: 5000 },
    },
  },
  quantization_config: {
    scalar: { type: 'int8', quantile: 0.99, always_ram: true },
  },
});
```

Payload indexes:

```typescript
// Namespace for scoping RAG retrieval to a content category
await qdrant.createPayloadIndex('knowledge_base', {
  field_name: 'namespace',   // e.g. 'faq' | 'legal' | 'process' | 'policy'
  field_schema: 'keyword',
});

// Language tag for multi-lingual retrieval
await qdrant.createPayloadIndex('knowledge_base', {
  field_name: 'locale',      // e.g. 'en' | 'sw'
  field_schema: 'keyword',
});

// Source article ID — for deduplication and linking back to the CMS record
await qdrant.createPayloadIndex('knowledge_base', {
  field_name: 'articleId',
  field_schema: 'keyword',
});
```

### Point Structure

```typescript
interface KnowledgeBasePoint {
  id: string;                     // chunkId (UUID) — one article → N chunks
  vector: {
    dense: number[];
    sparse: { indices: number[]; values: number[] };
  };
  payload: {
    chunkId: string;
    articleId: string;            // parent article — for grouping results
    title: string;                // article title — surfaced in RAG context
    excerpt: string;              // plain text of this chunk (≤ 512 tokens)
    namespace: string;
    locale: string;
    updatedAt: string;            // ISO timestamp — for staleness checks
  };
}
```

### Retrieval Pattern (RAG)

```typescript
// Knowledge base search with namespace + locale pre-filtering
async searchKnowledgeBase(params: {
  query: string;
  dense: number[];
  sparse: { indices: number[]; values: number[] };
  namespace?: string;
  locale: string;
  limit?: number;
}) {
  const must: Filter[] = [
    { key: 'locale', match: { value: params.locale } },
  ];
  if (params.namespace) {
    must.push({ key: 'namespace', match: { value: params.namespace } });
  }

  return this.client.query('knowledge_base', {
    prefetch: [
      { query: params.sparse, using: 'sparse', limit: 20 },
      { query: params.dense,  using: 'dense',  limit: 20 },
    ],
    query: { fusion: 'rrf' },
    filter: { must },
    limit: params.limit ?? 5,
    with_payload: ['articleId', 'title', 'excerpt'],
  });
}
```

Retrieved chunks are passed as context to the LLM. The `excerpt` field in the payload means the RAG pipeline avoids a secondary Prisma query for most responses — payload size is small enough (~512 tokens per chunk) to store inline.

### Chunking Strategy

| Article length | Chunk approach |
|---|---|
| Short (< 512 tokens) | Single chunk = whole article |
| Medium (512–2048 tokens) | Fixed-size chunks with 10% overlap |
| Long (> 2048 tokens) | Semantic chunking — split at paragraph/section boundaries |

Chunk overlap prevents relevant context from being split across boundaries. The `articleId` payload field groups chunks from the same article so the retrieval layer can deduplicate or merge adjacent chunks before sending to the LLM.

### Migration Scope

The knowledge base migration is **independent** of the document-matching migration and can happen at any time after Phase 1 (Qdrant infrastructure is up). No pgvector cleanup is needed because the knowledge base has not yet been built on pgvector — it will be built on Qdrant from day one.

When the knowledge base is ready:
1. Create the `knowledge_base` collection and payload indexes (one-time, idempotent)
2. Implement `KnowledgeBaseEmbeddingService` — chunks articles, generates dense + sparse vectors, upserts into Qdrant
3. Implement `KnowledgeBaseSearchService` — retrieves chunks for RAG
4. Wire into the chat/Q&A module (wherever the citizen-facing assistant is built)

No dual-write phase is needed since there is no legacy pgvector data to migrate.

---

## Summary — pgvector vs Qdrant

| Feature | pgvector | Qdrant |
|---|---|---|
| Language | C (Postgres extension) | Rust |
| Binary size | N/A | ~80 MB Docker image |
| Idle memory | ~200 MB (full Postgres) | ~25 MB |
| Startup time | 3–8 s | < 500 ms |
| Dense search | ✅ HNSW / IVFFlat | ✅ HNSW (hand-optimised) |
| Sparse search | ❌ | ✅ native |
| Hybrid search | ❌ | ✅ RRF fusion |
| Quantization | ❌ | ✅ int8 / PQ / binary |
| Pre-filter | ❌ (post-filter only) | ✅ inside HNSW traversal |
| Named vectors | ❌ (separate columns) | ✅ per-point |
| gRPC | ❌ | ✅ |
| Snapshot API | pg_dump | ✅ collection snapshot |
| Dashboard UI | pgAdmin / psql | ✅ built-in web UI |
| Scales independently | ❌ (tied to Postgres) | ✅ standalone service |
