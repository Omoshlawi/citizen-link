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
    const url = `/api/embeddings`;

    // Use task-specific prefixes for better accuracy
    const prefix =
      useCase === 'search' ? 'search_query: ' : 'search_document: ';

    const response = this.httpService.post<{
      embedding: Array<number>;
    }>(url, {
      model: 'nomic-embed-text', // or consider 'mxbai-embed-large' for better quality
      prompt: prefix + text,
    });

    return response.pipe(
      map((res) => res.data.embedding),
      catchError((error) => {
        this.logger.error('Error generating embedding', error);
        throw error;
      }),
    );
  }

  // Create a searchable text representation of a document
  createDocumentText(
    document: Document & {
      additionalFields: Array<DocumentField>;
      type: DocumentType;
      case: DocumentCase;
    },
  ): string {
    const parts: string[] = [];

    // Add context-rich description first (most important information first)
    if (document.type?.name && document.ownerName) {
      parts.push(
        `This is a ${document.type.name} document belonging to ${document.ownerName}`,
      );
    }

    // Add structured identity information
    if (document.ownerName) {
      parts.push(`Full name: ${document.ownerName}`);
    }

    if (document.dateOfBirth) {
      const dob = document.dateOfBirth.toISOString().split('T')[0];
      parts.push(`Date of birth: ${dob}`);
    }

    if (document.gender) {
      parts.push(`Gender: ${document.gender}`);
    }

    if (document.placeOfBirth) {
      parts.push(`Place of birth: ${document.placeOfBirth}`);
    }

    // Document identification
    if (document.documentNumber) {
      parts.push(`Document number: ${document.documentNumber}`);
    }

    if (document.serialNumber) {
      parts.push(`Serial number: ${document.serialNumber}`);
    }

    // Issuance information
    if (document.issuer) {
      parts.push(`Issued by: ${document.issuer}`);
    }

    if (document.placeOfIssue) {
      parts.push(`Place of issue: ${document.placeOfIssue}`);
    }

    // Additional fields with better formatting
    if (document.additionalFields?.length) {
      document.additionalFields.forEach((f) => {
        parts.push(`${f.fieldName}: ${f.fieldValue}`);
      });
    }

    // Tags - very important for semantic search
    if (document.case.tags && (document.case.tags as Array<string>).length) {
      const tags = (document.case.tags as Array<string>).join(', ');
      parts.push(`Related keywords and categories: ${tags}`);
    }

    // Join with periods for better sentence structure
    return parts.join('. ') + '.';
  }

  /**
   * Index a document by generating and storing its embedding
   */
  async indexDocument(documentId: string): Promise<void> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          type: true,
          additionalFields: true,
          case: true,
        },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Create searchable text
      const searchText = this.createDocumentText(document);
      this.logger.debug(`Indexing document ${documentId}: ${searchText}`);

      // Generate embedding
      const embedding = await lastValueFrom(
        this.generateEmbedding(searchText, 'document'),
      );

      // Convert embedding array to PostgreSQL vector format
      const vectorString = `[${embedding.join(',  ')}]`;

      // Store embedding using raw SQL
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Document" SET embedding = $1::vector WHERE id = $2`,
        vectorString,
        documentId,
      );

      this.logger.log(`Successfully indexed document ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to index document ${documentId}`, error);
      throw error;
    }
  }

  /**
   * Batch index multiple documents
   */
  async batchIndexDocuments(documentIds: string[]): Promise<void> {
    this.logger.log(`Batch indexing ${documentIds.length} documents`);

    for (const documentId of documentIds) {
      try {
        await this.indexDocument(documentId);
      } catch (error) {
        this.logger.error(
          `Failed to index document ${documentId} in batch`,
          error,
        );
        // Continue with other documents
      }
    }

    this.logger.log('Batch indexing completed');
  }
}
