/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  Document,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { AiConfig } from './ai.config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  constructor(
    private readonly config: AiConfig,
    private readonly prisma: PrismaService,
  ) {}

  async generateEmbedding(text: string): Promise<Array<number>> {
    try {
      const url = `${this.config.aiBaseUrl}/api/embeddings`;
      const response = await axios.post<{ embedding: Array<number> }>(url, {
        model: 'nomic-embed-text',
        prompt: text,
      });

      return response.data.embedding;
    } catch (error) {
      this.logger.error('Embedding generation failed:', error);
      throw error;
    }
  }

  // Create a searchable text representation of a document
  createDocumentText(
    document: Document & {
      additionalFields: Array<DocumentField>;
      type: DocumentType;
    },
  ): string {
    const parts = [
      // Add additional fields
      ...(document.additionalFields || []).map(
        (f) => `${f.fieldName}: ${f.fieldValue}`,
      ),
    ];

    // Add document type
    if (document.type?.name) {
      parts.push(`Document Type: ${document.type.name}`);
    }

    // Add owner name
    if (document.ownerName) {
      parts.push(`Owner: ${document.ownerName}`);
    }

    // Add document number
    if (document.documentNumber) {
      parts.push(`Document Number: ${document.documentNumber}`);
    }

    // Add serial number
    if (document.serialNumber) {
      parts.push(`Serial: ${document.serialNumber}`);
    }

    // Add date of birth
    if (document.dateOfBirth) {
      parts.push(`DOB: ${document.dateOfBirth.toISOString().split('T')[0]}`);
    }

    // Add place of birth
    if (document.placeOfBirth) {
      parts.push(`Birth Place: ${document.placeOfBirth}`);
    }

    // Add gender
    if (document.gender) {
      parts.push(`Gender: ${document.gender}`);
    }

    // Add issuer
    if (document.issuer) {
      parts.push(`Issuer: ${document.issuer}`);
    }

    // Add place of issue
    if (document.placeOfIssue) {
      parts.push(`Issue Place: ${document.placeOfIssue}`);
    }

    return parts.join(' | ');
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
        },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // Create searchable text
      const searchText = this.createDocumentText(document);
      this.logger.debug(`Indexing document ${documentId}: ${searchText}`);

      // Generate embedding
      const embedding = await this.generateEmbedding(searchText);

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
}
