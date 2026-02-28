/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmbeddingService } from '../ai/embeding.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CandidateMatch,
  FindMatchesOptions,
  PaginatedResult,
  VerifyMatchesOptions,
} from './matching.interface';
import { MatchingVerifierService } from './matching.verifier.service';
import { Match } from '../../generated/prisma/client';
import {
  CustomRepresentationService,
  PaginationService,
} from '../common/query-builder';
import { QueryMatechesForFoundCaseDto } from './matching.dto';
import { lastValueFrom } from 'rxjs';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';

@Injectable()
export class MatchLostDocumentService {
  private readonly logger = new Logger(MatchLostDocumentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchVerifierService: MatchingVerifierService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly humanIdService: HumanIdService,
  ) {}

  /**
   * Find candidate matches for a FOUND document (searches in LOST documents)
   * Returns raw similarity matches without LLM verification
   */
  async findMatches(
    foundDocumentId: string,
    options: FindMatchesOptions = {},
  ): Promise<PaginatedResult<CandidateMatch>> {
    const {
      limit = 10,
      skip = 0,
      similarityThreshold = 0.5,
      includeTotal = true,
    } = options;

    try {
      const foundDoc = await this.prismaService.document.findUnique({
        where: { id: foundDocumentId },
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
        throw new Error('Found document not found');
      }

      if (!foundDoc.case?.foundDocumentCase) {
        throw new Error('Document is not associated with a found case');
      }

      const searchText = this.embeddingService.createDocumentText(foundDoc);
      const searchEmbedding = await lastValueFrom(
        this.embeddingService.generateEmbedding(searchText, 'search'),
      );
      const vectorString = `[${searchEmbedding.join(',')}]`;

      // Get total count if requested
      let totalCount = 0;
      if (includeTotal) {
        const countResult = await this.prismaService.$queryRawUnsafe<
          Array<{ count: bigint }>
        >(
          `
          SELECT COUNT(*) as count
          FROM "documents" d
          INNER JOIN "document_cases" dc ON d."caseId" = dc.id
          INNER JOIN "lost_document_cases" ldc ON dc.id = ldc."caseId"
          WHERE 
            d.embedding IS NOT NULL
            AND d."typeId" = $1
            AND ldc.status = 'SUBMITTED'
            AND d.id != $2
            AND dc."userId" != $3
            AND 1 - (d.embedding <=> $4::vector) > $5
          `,
          foundDoc.typeId,
          foundDocumentId,
          foundDoc.case.userId,
          vectorString,
          similarityThreshold,
        );
        totalCount = Number(countResult[0]?.count || 0);
      }

      // Find similar LOST documents
      const candidateMatches = await this.prismaService.$queryRawUnsafe<
        Array<Omit<CandidateMatch, 'similarity'> & { similarity: string }>
      >(
        `
        SELECT 
          d.id as "documentId",
          d."caseId",
          d."typeId",
          d."fullName",
          d."documentNumber",
          d."serialNumber",
          d."dateOfBirth",
          d."placeOfBirth",
          1 - (d.embedding <=> $1::vector) as similarity
        FROM "documents" d
        INNER JOIN "document_cases" dc ON d."caseId" = dc.id
        INNER JOIN "lost_document_cases" ldc ON dc.id = ldc."caseId"
        WHERE 
          d.embedding IS NOT NULL
          AND d."typeId" = $2
          AND ldc.status = 'SUBMITTED'
          AND d.id != $3
          AND dc."userId" != $4
          AND 1 - (d.embedding <=> $1::vector) > $5
        ORDER BY d.embedding <=> $1::vector
        LIMIT $6
        OFFSET $7
        `,
        vectorString,
        foundDoc.typeId,
        foundDocumentId,
        foundDoc.case.userId,
        similarityThreshold,
        limit,
        skip,
      );

      const matches: CandidateMatch[] = candidateMatches.map((match) => ({
        ...match,
        similarity: parseFloat(match.similarity),
      }));

      const currentPage = Math.floor(skip / limit) + 1;
      const totalPages = includeTotal ? Math.ceil(totalCount / limit) : 0;

      this.logger.log(
        `Found ${matches.length} candidate matches for FOUND document ${foundDocumentId} ` +
          `(page ${currentPage}${includeTotal ? ` of ${totalPages}` : ''})`,
      );

      return {
        data: matches,
        total: includeTotal ? totalCount : -1,
        page: currentPage,
        pageSize: limit,
        totalPages: includeTotal ? totalPages : -1,
        hasMore: includeTotal
          ? skip + limit < totalCount
          : matches.length === limit,
      };
    } catch (error) {
      this.logger.error(
        `Failed to find matches for FOUND document ${foundDocumentId}`,
        error,
      );
      throw error;
    }
  }

  async findMatchesAndVerify(
    foundDocumentId: string,
    userId: string,
    options: FindMatchesOptions & VerifyMatchesOptions = {},
  ) {
    const { minVerificationScore = 0.6 } = options;

    // Get full source document
    const sourceDoc = await this.prismaService.document.findUnique({
      where: { id: foundDocumentId },
      select: {
        case: {
          include: {
            document: {
              include: {
                type: true,
                additionalFields: true,
              },
            },
            foundDocumentCase: true,
          },
        },
      },
    });

    if (!sourceDoc) {
      throw new NotFoundException('Source document not found');
    }
    if (!sourceDoc.case.foundDocumentCase) {
      throw new BadRequestException(
        'Souce document is not asociated with found case',
      );
    }
    const candidateResult = await this.findMatches(foundDocumentId, options);
    const candidates = candidateResult.data;
    if (candidates.length === 0) {
      return [];
    }
    const verifiedMatches: Array<Match> = [];
    for (const candidate of candidates) {
      // Get full candidate document
      const candidateDoc = await this.prismaService.document.findUnique({
        where: { id: candidate.documentId },
        select: {
          case: {
            include: {
              document: {
                include: {
                  type: true,
                  additionalFields: true,
                },
              },
              lostDocumentCase: true,
            },
          },
        },
      });

      if (!candidateDoc) {
        this.logger.warn(
          `Candidate document ${candidate.documentId} not found`,
        );
        continue;
      }

      if (!candidateDoc.case.lostDocumentCase) {
        this.logger.warn(
          `Candidate document ${candidate.documentId} is not asociated with lost case`,
        );
        continue;
      }

      // Verify using LLM
      const { aiInteraction, matchData } =
        await this.matchVerifierService.verifyMatch(
          sourceDoc.case as any,
          candidateDoc.case as any,
          userId,
        );
      if (matchData.overallScore >= minVerificationScore) {
        const match = await this.prismaService.match.create({
          data: {
            matchNumber: await this.humanIdService.generate({
              prefix: EntityPrefix.MATCH,
            }),
            aiInteractionId: aiInteraction.id,
            foundDocumentCaseId: sourceDoc.case.foundDocumentCase.id,
            lostDocumentCaseId: candidateDoc.case.lostDocumentCase.id,
            matchScore: matchData.overallScore,
            aiAnalysis: matchData as any,
          },
        });
        verifiedMatches.push(match);
      }
    }
    // Sort by overall score in descending order
    verifiedMatches.sort((a, b) => {
      return b.matchScore - a.matchScore;
    });

    this.logger.log(
      `Verified ${verifiedMatches.length}/${candidates.length} matches ` +
        `for document ${foundDocumentId}`,
    );

    return verifiedMatches;
  }
  async queryMatchesForFoundDocumentCase(query: QueryMatechesForFoundCaseDto) {
    const { foundDocumentCaseId, minMatchScore, v } = query;
    const founsCase = await this.prismaService.foundDocumentCase.findUnique({
      where: { id: foundDocumentCaseId },
      include: {
        case: {
          include: {
            document: true,
          },
        },
      },
    });
    if (!founsCase) throw new NotFoundException('Lost case not found');
    const foundDocumentId = founsCase.case.document?.id;
    if (!foundDocumentId)
      throw new NotFoundException('Found case has no asociated document');
    const { skip, take } = this.paginationService.buildPaginationQuery(query);
    const matches = await this.findMatches(foundDocumentId, {
      includeTotal: true,
      limit: take,
      skip,
      similarityThreshold: minMatchScore,
    });
    const cases = await this.prismaService.documentCase.findMany({
      where: {
        document: {
          id: {
            in: matches.data.map((d) => d.documentId),
          },
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(v),
    });
    return {
      results: cases.map((c, i) => ({
        ...c,
        similarity: matches.data[i].similarity,
      })),
    };
  }
}
