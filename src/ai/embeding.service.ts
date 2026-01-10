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

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  constructor(private readonly config: AiConfig) {}

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
      document.ownerName,
      document.documentNumber,
      document.serialNumber,
      document.dateOfBirth?.toISOString(),
      document.placeOfBirth,
      document.issuer,
      document.placeOfIssue,
      document.type?.name,
      // Add additional fields
      ...(document.additionalFields || []).map(
        (f) => `${f.fieldName}: ${f.fieldValue}`,
      ),
    ].filter(Boolean);

    return parts.join(' | ');
  }
}
