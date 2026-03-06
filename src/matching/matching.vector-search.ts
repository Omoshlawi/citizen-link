import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingQueryService } from './matching.query.service';
import {
  QueryMatchesForFoundCaseDto,
  QueryMatchesForLostCaseDto,
} from './matching.dto';
import { EmbeddingService } from '../ai/embeding.service';
import { lastValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';
import { CustomRepresentationService } from '../common/query-builder';

@Injectable()
export class MatchingVectorSearchService {
  private readonly logger = new Logger(MatchingVectorSearchService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly matchingQueryService: MatchingQueryService,
    private readonly embeddingService: EmbeddingService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  async findSimilarLostDocumentCasesForFoundDocumentCase(
    query: QueryMatchesForFoundCaseDto,
  ) {
    const { limit = 10, minMatchScore = 0.5, v, foundDocumentCase } = query;
    try {
      const foundDoc = await this.prismaService.document.findFirst({
        where: {
          case: {
            OR: [
              {
                foundDocumentCase: {
                  id: foundDocumentCase,
                },
              },
              {
                caseNumber: foundDocumentCase,
              },
            ],
          },
        },
        include: {
          type: true,
          additionalFields: true,
          case: {
            include: {
              foundDocumentCase: true,
            },
          },
        },
      });

      if (!foundDoc) {
        throw new NotFoundException('Found document not found');
      }

      const searchText = this.embeddingService.createDocumentText(foundDoc);
      const searchEmbedding = await lastValueFrom(
        this.embeddingService.generateEmbedding(searchText, 'search'),
      );
      const lostCandidates = await this.matchingQueryService.findLostCandidates(
        {
          embeddingVector: searchEmbedding,
          excludeDocumentId: foundDoc.id,
          similarityThreshold: minMatchScore,
          topN: limit,
          excludeUserId: foundDoc.case.userId,
          typeId: foundDoc.typeId,
        },
      );
      this.logger.log(
        `Found ${lostCandidates.length} lost candidates for found document ${foundDoc.documentNumber}`,
      );
      const cases = await this.prismaService.documentCase.findMany({
        where: {
          document: {
            id: {
              in: lostCandidates.map((c) => c.documentId),
            },
          },
        },
        ...this.representationService.buildCustomRepresentationQuery(v),
      });
      return {
        results: cases.map((c, i) => ({
          ...c,
          similarity: lostCandidates[i].similarity,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to find matches for found document case ${foundDocumentCase}`,
        error,
      );
      throw error;
    }
  }

  async findSimilarFoundDocumentCasesForLostDocumentCase(
    query: QueryMatchesForLostCaseDto,
  ) {
    const { limit = 10, minMatchScore = 0.5, v, lostDocumentCase } = query;
    try {
      const lostDoc = await this.prismaService.document.findFirst({
        where: {
          case: {
            OR: [
              {
                lostDocumentCase: {
                  id: lostDocumentCase,
                },
              },
              {
                caseNumber: lostDocumentCase,
              },
            ],
          },
        },
        include: {
          type: true,
          additionalFields: true,
          case: {
            include: {
              lostDocumentCase: true,
            },
          },
        },
      });
      if (!lostDoc) {
        throw new NotFoundException('Lost document not found');
      }
      const searchText = this.embeddingService.createDocumentText(lostDoc);
      const searchEmbedding = await lastValueFrom(
        this.embeddingService.generateEmbedding(searchText, 'search'),
      );
      const foundCandidates =
        await this.matchingQueryService.findFoundCandidates({
          embeddingVector: searchEmbedding,
          excludeDocumentId: lostDoc.id,
          similarityThreshold: minMatchScore,
          topN: limit,
          excludeUserId: lostDoc.case.userId,
          typeId: lostDoc.typeId,
        });
      this.logger.log(
        `Found ${foundCandidates.length} found candidates for lost document ${lostDoc.documentNumber}`,
      );
      const cases = await this.prismaService.documentCase.findMany({
        where: {
          document: {
            id: {
              in: foundCandidates.map((c) => c.documentId),
            },
          },
        },
        ...this.representationService.buildCustomRepresentationQuery(v),
      });
      return {
        results: cases.map((c, i) => ({
          ...c,
          similarity: foundCandidates[i].similarity,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to find matches for lost document case ${lostDocumentCase}`,
        error,
      );
      throw error;
    }
  }
}
