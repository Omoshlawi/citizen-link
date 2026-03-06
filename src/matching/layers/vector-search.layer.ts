import { Inject, Injectable, Logger } from '@nestjs/common';
import { MatchingQueryService } from '../matching.query.service';
import { MatchTrigger } from '../../../generated/prisma/enums';
import {
  CandidateMatch,
  FindMatchesOptions,
  MatchingOptions,
} from '../matching.interface';
import { MATCHING_OPTIONS_TOKEN } from '../matching.constants';

@Injectable()
export class VectorSearchLayer {
  private readonly logger = new Logger(VectorSearchLayer.name);

  constructor(
    private readonly queryService: MatchingQueryService,
    @Inject(MATCHING_OPTIONS_TOKEN)
    private readonly matchingOptions: MatchingOptions,
  ) {}

  async findCandidates(
    trigger: MatchTrigger,
    documentId: string,
    caseUserId: string,
    typeId: string,
    embeddingVector: number[],
    options?: FindMatchesOptions,
  ): Promise<CandidateMatch[]> {
    this.logger.debug(
      `Layer 1 — vector search | trigger: ${trigger} | documentId: ${documentId}`,
    );

    const params = {
      embeddingVector,
      typeId,
      excludeDocumentId: documentId,
      excludeUserId: caseUserId,
      similarityThreshold:
        options?.similarityThreshold ??
        this.matchingOptions.vectorSimilarityThreshold,
      topN: options?.limit ?? this.matchingOptions.topNCandidates,
    };

    const candidates =
      trigger === MatchTrigger.LOST_CASE_SUBMITTED
        ? await this.queryService.findFoundCandidates(params) // lost → search found
        : await this.queryService.findLostCandidates(params); // found → search lost

    this.logger.debug(
      `Layer 1 — found ${candidates.length} candidates above ` +
        `threshold ${params.similarityThreshold}`,
    );

    if (candidates.length > 0) {
      this.logger.debug(
        `Layer 1 — top candidate: ${candidates[0].fullName} ` +
          `similarity: ${candidates[0].similarity}`,
      );
    }

    return candidates;
  }
}
