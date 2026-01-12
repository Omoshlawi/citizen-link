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

@Injectable()
export class MatchFoundDocumentService {
  private readonly logger = new Logger(MatchFoundDocumentService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly matchVerifierService: MatchingVerifierService,
  ) {}

  /**
   * Find candidate matches for a LOST document (searches in FOUND documents)
   * Returns raw similarity matches without LLM verification
   */
  async findMatches(
    lostDocumentId: string,
    options: FindMatchesOptions = {},
  ): Promise<PaginatedResult<CandidateMatch>> {
    const {
      limit = 10,
      skip = 0,
      similarityThreshold = 0.5,
      includeTotal = true,
    } = options;

    try {
      const lostDoc = await this.prismaService.document.findUnique({
        where: { id: lostDocumentId },
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

      if (!lostDoc.case?.lostDocumentCase) {
        throw new BadRequestException(
          'Document is not associated with a lost case',
        );
      }

      const searchText = this.embeddingService.createDocumentText(lostDoc);
      const searchEmbedding =
        await this.embeddingService.generateEmbedding(searchText);
      const vectorString = `[${searchEmbedding.join(',')}]`;

      // Get total count if requested
      let totalCount = 0;
      if (includeTotal) {
        const countResult = await this.prismaService.$queryRawUnsafe<
          Array<{ count: bigint }>
        >(
          `
              SELECT COUNT(*) as count
              FROM "Document" d
              INNER JOIN "DocumentCase" dc ON d."caseId" = dc.id
              INNER JOIN "FoundDocumentCase" fdc ON dc.  = fdc."caseId"
              WHERE 
                d.embedding IS NOT NULL
                AND d."typeId" = $1
                AND fdc.status IN ('VERIFIED')
                AND d.id != $2
                AND 1 - (d.embedding <=> $3::vector) > $4
              `,
          lostDoc.typeId,
          lostDocumentId,
          vectorString,
          similarityThreshold,
        );
        totalCount = Number(countResult[0]?.count || 0);
      }

      // Find similar FOUND documents
      const candidateMatches = await this.prismaService.$queryRawUnsafe<
        Array<Omit<CandidateMatch, 'similarity'> & { similarity: string }>
      >(
        `
            SELECT 
              d.id as "documentId",
              d."caseId",
              d."typeId",
              d."ownerName",
              d."documentNumber",
              d."serialNumber",
              d."dateOfBirth",
              d."placeOfBirth",
              1 - (d.embedding <=> $1::vector) as similarity
            FROM "Document" d
            INNER JOIN "DocumentCase" dc ON d."caseId" = dc.id
            INNER JOIN "FoundDocumentCase" fdc ON dc.id = fdc."caseId"
            WHERE 
              d.embedding IS NOT NULL
              AND d."typeId" = $2
              AND fdc.status IN ('VERIFIED')
              AND d.id != $3
              AND 1 - (d.embedding <=> $1::vector) > $4
            ORDER BY d.embedding <=> $1::vector
            LIMIT $5
            OFFSET $6
            `,
        vectorString,
        lostDoc.typeId,
        lostDocumentId,
        similarityThreshold,
        limit,
        skip,
      );

      const matches: Array<CandidateMatch> = candidateMatches.map((match) => ({
        ...match,
        similarity: parseFloat(match.similarity),
      }));

      const currentPage = Math.floor(skip / limit) + 1;
      const totalPages = includeTotal ? Math.ceil(totalCount / limit) : 0;

      this.logger.log(
        `Found ${matches.length} candidate matches for LOST document ${lostDocumentId} ` +
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
        `Failed to find matches for LOST document ${lostDocumentId}`,
        error,
      );
      throw error;
    }
  }

  async findMatchesAndVerify(
    lostDocumentId: string,
    userId: string,
    options: FindMatchesOptions & VerifyMatchesOptions = {},
  ) {
    const { minVerificationScore = 0.6 } = options;

    // Get full source document
    const sourceDoc = await this.prismaService.document.findUnique({
      where: { id: lostDocumentId },
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

    if (!sourceDoc) {
      throw new NotFoundException('Source document not found');
    }
    if (!sourceDoc.case.lostDocumentCase) {
      throw new BadRequestException(
        'Souce document is not asociated with lost case',
      );
    }
    const candidateResult = await this.findMatches(lostDocumentId, options);
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
              foundDocumentCase: true,
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

      if (!candidateDoc.case.foundDocumentCase) {
        this.logger.warn(
          `Candidate document ${candidate.documentId} is not asociated with found case`,
        );
        continue;
      }

      // Verify using LLM
      const { aiInteraction, matchData } =
        await this.matchVerifierService.verifyMatch(
          candidateDoc.case as any,
          sourceDoc.case as any,
          userId,
        );
      if (matchData.overallScore >= minVerificationScore) {
        const match = await this.prismaService.match.create({
          data: {
            aiInteractionId: aiInteraction.id,
            foundDocumentCaseId: sourceDoc.case.lostDocumentCase.id,
            lostDocumentCaseId: candidateDoc.case.foundDocumentCase.id,
            matchScore: matchData.overallScore,
            aiAnalysis: matchData as any,
          },
        });
        verifiedMatches.push(match);
      }
    }
    // Sort verified matches by overall score in descending order
    verifiedMatches.sort((a, b) => b.matchScore - a.matchScore);

    this.logger.log(
      `Verified ${verifiedMatches.length}/${candidates.length} matches ` +
        `for document ${lostDocumentId}`,
    );

    return verifiedMatches;
  }
}
