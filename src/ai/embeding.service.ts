import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map, Observable } from 'rxjs';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  generateEmbedding(
    text: string,
    useCase: 'search' | 'document' = 'document',
  ): Observable<Array<number>> {
    const prefix =
      useCase === 'search' ? 'search_query: ' : 'search_document: ';

    return this.httpService
      .post<{ embedding: Array<number> }>(`/api/embeddings`, {
        model: 'nomic-embed-text',
        prompt: prefix + text,
      })
      .pipe(
        map((res) => res.data.embedding),
        catchError((error) => {
          this.logger.error('Error generating embedding', error);
          throw error;
        }),
      );
  }

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

  async indexDocument(documentId: string): Promise<void> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: { type: true, additionalFields: true, case: true },
      });

      if (!document) throw new Error(`Document not found: ${documentId}`);

      const searchText = this.createDocumentText(document);
      this.logger.debug(`Indexing document ${documentId}: ${searchText}`);

      const embedding = await lastValueFrom(
        this.generateEmbedding(searchText, 'document'),
      );

      const vectorString = `[${embedding.join(',')}]`;

      await this.prisma.$executeRawUnsafe(
        `UPDATE "documents" SET embedding = $1::vector WHERE id = $2`,
        vectorString,
        documentId,
      );

      this.logger.log(`Successfully indexed document ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to index document ${documentId}`, error);
      throw error;
    }
  }

  async batchIndexDocuments(
    documentIds: string[],
    concurrency = 5, // process 5 at a time — safe for Ollama local instance
  ): Promise<{ succeeded: string[]; failed: string[] }> {
    this.logger.log(`Batch indexing ${documentIds.length} documents`);

    const succeeded: string[] = [];
    const failed: string[] = [];

    // Process in chunks instead of one-by-one
    for (let i = 0; i < documentIds.length; i += concurrency) {
      const chunk = documentIds.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        chunk.map((id) => this.indexDocument(id)),
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
