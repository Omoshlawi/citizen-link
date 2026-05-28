import { Inject, Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { distance as levenshtein } from 'fastest-levenshtein';
import { EmbeddingService } from '../embedding/embedding.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import {
  OCR_CONFUSION_PAIRS,
  MATCHING_OPTIONS_TOKEN,
} from './matching.constants';
import { MatchingOptions } from './matching.interface';
import { MatchingQueryService } from './matching.query.service';

const PUBLIC_SEARCH_LIMIT = 3;
const PUBLIC_SEARCH_MIN_SCORE = 0.65;

// documentNumber (0.4) and fullName (0.3) rescaled to sum to 1.0
const PUBLIC_DOC_NUM_WEIGHT = 0.571;
const PUBLIC_FULL_NAME_WEIGHT = 0.429;

// No AI layer available — blend vector + exact only
const VECTOR_BLEND = 0.4;
const EXACT_BLEND = 0.6;

export interface PublicSearchResultItem {
  maskedName: string;
  blurredImageBase64: string | null;
}

export interface PublicSearchResult {
  found: boolean;
  results: PublicSearchResultItem[];
}

@Injectable()
export class PublicSearchService {
  private readonly logger = new Logger(PublicSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchingQueryService: MatchingQueryService,
    private readonly s3Service: S3Service,
    @Inject(MATCHING_OPTIONS_TOKEN)
    private readonly matchingOptions: MatchingOptions,
  ) {}

  async search(params: {
    documentTypeId: string;
    fullName?: string;
    documentNumber?: string;
  }): Promise<PublicSearchResult> {
    const { documentTypeId, fullName, documentNumber } = params;

    const docType = await this.prisma.documentType.findUnique({
      where: { id: documentTypeId },
      select: { name: true },
    });
    if (!docType) return { found: false, results: [] };

    const searchText = this.buildSearchText(
      docType.name,
      fullName,
      documentNumber,
    );
    this.logger.debug(`Public search text: ${searchText}`);

    const embeddingVector = await lastValueFrom(
      this.embeddingService.generateEmbedding(searchText, 'search'),
    );

    const candidates =
      await this.matchingQueryService.findPublicSearchCandidates({
        embeddingVector,
        typeId: documentTypeId,
        similarityThreshold: this.matchingOptions.vectorSimilarityThreshold,
        limit: PUBLIC_SEARCH_LIMIT * 3,
      });

    if (candidates.length === 0) return { found: false, results: [] };

    const scored = candidates
      .map((candidate) => {
        const docNumScore = this.compare(
          documentNumber,
          candidate.documentNumber,
          false,
        );
        const nameScore = this.compare(fullName, candidate.fullName, true);
        const exactScore =
          docNumScore * PUBLIC_DOC_NUM_WEIGHT +
          nameScore * PUBLIC_FULL_NAME_WEIGHT;
        const finalScore =
          candidate.similarity * VECTOR_BLEND + exactScore * EXACT_BLEND;
        return { candidate, finalScore };
      })
      .filter(({ finalScore }) => finalScore >= PUBLIC_SEARCH_MIN_SCORE)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, PUBLIC_SEARCH_LIMIT);

    if (scored.length === 0) return { found: false, results: [] };

    const results = await Promise.all(
      scored.map(async ({ candidate }) => ({
        maskedName: this.maskName(candidate.fullName ?? ''),
        blurredImageBase64: await this.fetchBase64(candidate.blurredImageKey),
      })),
    );

    return { found: true, results };
  }

  private async fetchBase64(key?: string | null): Promise<string | null> {
    if (!key) return null;
    try {
      const buffer = await this.s3Service.downloadFile(key, 'cases');
      return buffer.toString('base64');
    } catch (err) {
      this.logger.warn(`Failed to fetch blurred image for key ${key}: ${err}`);
      return null;
    }
  }

  private buildSearchText(
    typeName: string,
    fullName?: string,
    documentNumber?: string,
  ): string {
    const parts: string[] = [];
    if (fullName)
      parts.push(`This is a ${typeName} document belonging to ${fullName}`);
    if (fullName) parts.push(`Full name: ${fullName}`);
    if (documentNumber) parts.push(`Document number: ${documentNumber}`);
    parts.push(`Document type: ${typeName}`);
    return parts.join('. ') + '.';
  }

  private maskName(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .map((word) =>
        word.length <= 1 ? word : word[0] + '*'.repeat(word.length - 1),
      )
      .join(' ');
  }

  private compare(
    a: string | null | undefined,
    b: string | null | undefined,
    loose: boolean,
  ): number {
    if (!a || !b) return 0;
    const normA = loose ? this.normaliseLoose(a) : this.normalise(a);
    const normB = loose ? this.normaliseLoose(b) : this.normalise(b);
    if (normA === normB) return 1.0;
    const corrA = this.applyOcrCorrections(normA);
    const corrB = this.applyOcrCorrections(normB);
    if (corrA === corrB) return 0.9;
    const dist = levenshtein(normA, normB);
    if (dist === 1) return 0.85;
    if (dist === 2) return 0.65;
    return 0;
  }

  private normalise(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private normaliseLoose(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .sort()
      .join(' ');
  }

  private applyOcrCorrections(value: string): string {
    let result = value;
    for (const [a, b] of OCR_CONFUSION_PAIRS) {
      result = result.replaceAll(b, a);
    }
    return result;
  }
}
