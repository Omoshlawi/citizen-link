import { Injectable, Logger } from '@nestjs/common';
import { from, map, Observable } from 'rxjs';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocaiService } from './docai.service';

@Injectable()
export class DocaiEmbeddingService {
  private readonly logger = new Logger(DocaiEmbeddingService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly docaiService: DocaiService,
  ) {}

  /**
   * Generate an embedding vector via docai.
   *
   * Returns an Observable<number[]> for backward compatibility with any callers
   * that consume it as a stream (e.g. matching service search queries).
   */
  generateEmbedding(
    text: string,
    useCase: 'search' | 'document' = 'document',
  ): Observable<number[]> {
    return from(this.docaiService.embed(text, useCase)).pipe(
      map((r) => r.embedding),
    );
  }

  /**
   * Build a single searchable text string from all document fields.
   * This is the canonical document representation used for embedding.
   */
  createDocumentText(
    document: Document & {
      additionalFields: Array<DocumentField>;
      type: DocumentType;
      case: DocumentCase;
    },
  ): string {
    const parts: string[] = [];

    // ─── Identity context first ─────────────────────────
    if (document.fullName && document.type?.name) {
      parts.push(
        `This is a ${document.type.name} document belonging to ${document.fullName}`,
      );
    }

    if (document.fullName) parts.push(`Full name: ${document.fullName}`);
    if (document.surname) parts.push(`Surname: ${document.surname}`);

    if (document.givenNames?.length) {
      parts.push(`Given names: ${document.givenNames.join(' ')}`);
    }
    if (document.dateOfBirth) {
      parts.push(
        `Date of birth: ${document.dateOfBirth.toISOString().split('T')[0]}`,
      );
    }

    if (document.gender) parts.push(`Gender: ${document.gender}`);
    if (document.placeOfBirth)
      parts.push(`Place of birth: ${document.placeOfBirth}`);

    // ─── Document identifiers ───────────────────────────────────
    if (document.type.name) parts.push(`Document type: ${document.type.name}`);
    if (document.type.code) parts.push(`Document code: ${document.type.code}`);
    if (document.documentNumber)
      parts.push(`Document number: ${document.documentNumber}`);
    if (document.serialNumber)
      parts.push(`Serial number: ${document.serialNumber}`);
    if (document.issuer) parts.push(`Issued by: ${document.issuer}`);
    if (document.placeOfIssue)
      parts.push(`Place of issue: ${document.placeOfIssue}`);

    // ─── Address — important for lost/found matching ────────────
    if (document.addressRaw) {
      parts.push(`Address: ${document.addressRaw}`);
    }

    if (Array.isArray(document.addressComponents)) {
      const components = (
        document.addressComponents as Array<{ type: string; value: string }>
      )
        .map((c) => `${c.type}: ${c.value}`)
        .join(', ');
      if (components) parts.push(`Address details: ${components}`);
    }

    // ─── Additional fields ──────────────────────────────────────
    if (document.additionalFields?.length) {
      document.additionalFields.forEach((f) => {
        parts.push(`${f.fieldName}: ${f.fieldValue}`);
      });
    }

    // ─── Case tags ──────────────────────────────────────────────
    const tags = Array.isArray(document.case?.tags)
      ? (document.case.tags as Array<string>).filter(Boolean)
      : [];

    if (tags.length) {
      parts.push(`Related keywords and categories: ${tags.join(', ')}`);
    }

    return parts.filter(Boolean).join('. ') + '.';
  }

  /**
   * Generate and persist an embedding for a single document.
   *
   * Delegates to docai POST /v1/embed — dims in the response determines
   * which pgvector column is updated (embedding_768 or embedding_1536).
   */
  async embeddDocument(documentId: string): Promise<void> {
    try {
      const document = await this.prismaService.document.findUnique({
        where: { id: documentId },
        include: { type: true, additionalFields: true, case: true },
      });

      if (!document) throw new Error(`Document not found: ${documentId}`);

      const searchText = this.createDocumentText(document);
      this.logger.debug(`Indexing document ${documentId}: ${searchText}`);

      const { embedding, dims } = await this.docaiService.embed(
        searchText,
        'document',
      );

      const vectorString = `[${embedding.join(',')}]`;

      await this.prismaService.$executeRawUnsafe(
        `UPDATE "documents" SET embedding_${dims} = $1::vector WHERE id = $2`,
        vectorString,
        documentId,
      );

      this.logger.log(
        `Successfully indexed document ${documentId} (${dims}-dim vector)`,
      );
    } catch (error) {
      this.logger.error(`Failed to index document ${documentId}`, error);
      throw error;
    }
  }

  /**
   * Embed multiple documents in parallel batches.
   * Default concurrency of 5 is safe for a single docai instance.
   */
  async batchIndexDocuments(
    documentIds: string[],
    concurrency = 5,
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    this.logger.log(`Batch indexing ${documentIds.length} documents`);

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < documentIds.length; i += concurrency) {
      const chunk = documentIds.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        chunk.map((id) => this.embeddDocument(id)),
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          succeeded.push(chunk[index]);
        } else {
          this.logger.error(
            `Failed to index document ${chunk[index]}`,
            result.reason,
          );
          failed.push(chunk[index]);
        }
      });
    }

    this.logger.log(
      `Batch indexing complete — succeeded: ${succeeded.length}, failed: ${failed.length}`,
    );

    return { succeeded, failed };
  }
}
