import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '../ai/embeding.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatchFoundDocumentService } from './matching.found.service';
import { FindMatchesOptions, VerifyMatchesOptions } from './matching.interface';
import { MatchLostDocumentService } from './matching.lost.service';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchFoundDocumentService: MatchFoundDocumentService,
    private readonly matchLostDocumentService: MatchLostDocumentService,
  ) {}

  /**
   * Get match statistics
   */
  async getMatchStatistics(
    documentId: string,
    isLostDocument: boolean,
    options: { similarityThreshold?: number } = {},
  ): Promise<{
    totalPotentialMatches: number;
    highSimilarityCount: number;
    mediumSimilarityCount: number;
    lowSimilarityCount: number;
  }> {
    const { similarityThreshold = 0.5 } = options;

    const document = await this.prismaService.document.findUnique({
      where: { id: documentId },
      include: { type: true, additionalFields: true, case: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const searchText = this.embeddingService.createDocumentText(document);
    const searchEmbedding =
      await this.embeddingService.generateEmbedding(searchText);
    const vectorString = `[${searchEmbedding.join(',')}]`;

    // Build query based on document type
    const caseTypeTable = isLostDocument
      ? 'FoundDocumentCase'
      : 'LostDocumentCase';
    const statusCondition = isLostDocument
      ? `fdc.status IN ('VERIFIED')`
      : `ldc.status = 'SUBMITTED'`;

    const stats = await this.prismaService.$queryRawUnsafe<
      Array<{
        total: string;
        high_similarity: string;
        medium_similarity: string;
        low_similarity: string;
      }>
    >(
      `
      SELECT 
        COUNT(*) FILTER (WHERE 1 - (d.embedding <=> $1::vector) >= 0.85) as high_similarity,
        COUNT(*) FILTER (WHERE 1 - (d.embedding <=> $1::vector) >= 0.70 AND 1 - (d.embedding <=> $1::vector) < 0.85) as medium_similarity,
        COUNT(*) FILTER (WHERE 1 - (d.embedding <=> $1::vector) >= $4 AND 1 - (d.embedding <=> $1::vector) < 0.70) as low_similarity,
        COUNT(*) as total
      FROM "Document" d
      INNER JOIN "DocumentCase" dc ON d."caseId" = dc.id
      INNER JOIN "${caseTypeTable}" ${isLostDocument ? 'fdc' : 'ldc'} ON dc.id = ${isLostDocument ? 'fdc' : 'ldc'}."caseId"
      WHERE 
        d.embedding IS NOT NULL
        AND d."typeId" = $2
        AND ${statusCondition}
        AND d.id != $3
        AND 1 - (d.embedding <=> $1::vector) > $4
      `,
      vectorString,
      document.typeId,
      documentId,
      similarityThreshold,
    );

    const result = stats[0] || {};

    return {
      totalPotentialMatches: Number(result.total || 0),
      highSimilarityCount: Number(result.high_similarity || 0),
      mediumSimilarityCount: Number(result.medium_similarity || 0),
      lowSimilarityCount: Number(result.low_similarity || 0),
    };
  }

  findMatchesForLostDocument(
    lostDocumentId: string,
    options: FindMatchesOptions = {},
  ) {
    return this.matchFoundDocumentService.findMatches(lostDocumentId, options);
  }
  findMatchesForFoundDocument(
    foundDocumentId: string,
    options: FindMatchesOptions = {},
  ) {
    return this.matchLostDocumentService.findMatches(foundDocumentId, options);
  }

  findMatchesForFoundDocumentAndVerify(
    foundDocumentId: string,
    userId: string,
    options: FindMatchesOptions & VerifyMatchesOptions = {},
  ) {
    return this.matchLostDocumentService.findMatchesAndVerify(
      foundDocumentId,
      userId,
      options,
    );
  }
  findMatchesForLostDocumentAndVerify(
    lostDocumentId: string,
    userId: string,
    options: FindMatchesOptions & VerifyMatchesOptions = {},
  ) {
    return this.matchFoundDocumentService.findMatchesAndVerify(
      lostDocumentId,
      userId,
      options,
    );
  }
}
