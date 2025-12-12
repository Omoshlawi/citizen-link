/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { pick } from 'lodash';
import {
  ActorType,
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
  MatchStatus,
} from '../../generated/prisma/client';
import { AiMatchingService } from '../ai/ai.matching.service';
import { CaseStatusTransitionsService } from '../case-status-transitions/case-status-transitions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../query-builder';
import {
  AcceptMatchDto,
  AdminVerifyMatchDto,
  CompleteMatchDto,
  QueryMatchesDto,
  RejectMatchDto,
} from './matches.dto';
import { v4 as uuidv4 } from 'uuid';

const MATCH_THRESHOLD = 0.65; // Minimum AI confidence score to create a match

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly matchDocumentsService: AiMatchingService,
    private readonly caseStatusTransitionsService: CaseStatusTransitionsService,
  ) {}

  /**
   * Calculate match score between found and lost documents using AI
   */
  async calculateMatchScore(
    foundCaseId: string,
    lostCaseId: string,
  ): Promise<{
    score: number;
    breakdown: Record<string, number>;
    reasons: string[];
    isExactMatch: boolean;
  }> {
    // Fetch both cases with full document details
    const [foundCase, lostCase] = await Promise.all([
      this.prismaService.documentCase.findUnique({
        where: { id: foundCaseId },
        include: {
          document: {
            include: {
              type: true,
              additionalFields: true,
            },
          },
          foundDocumentCase: true,
        },
      }),
      this.prismaService.documentCase.findUnique({
        where: { id: lostCaseId },
        include: {
          document: {
            include: {
              type: true,
              additionalFields: true,
            },
          },
          lostDocumentCase: true,
        },
      }),
    ]);

    if (!foundCase?.document || !lostCase?.document) {
      throw new NotFoundException('Document cases not found');
    }

    // Check if document types match (required for matching)
    if (foundCase.document.typeId !== lostCase.document.typeId) {
      return {
        score: 0,
        breakdown: { documentType: 0 },
        reasons: ['Document types do not match - no match possible'],
        isExactMatch: false,
      };
    }

    try {
      // Use AI to determine match confidence
      // Type assertion needed because Prisma types don't exactly match AI service types
      // but the runtime structure is compatible (we've already checked document is not null)
      const aiResult = await this.matchDocumentsService.matchDocuments(
        foundCase as any,
        lostCase as any,
      );

      const confidence = Math.max(0, Math.min(1, aiResult.confidence || 0));
      const isExactMatch = confidence >= 0.95; // Very high confidence indicates exact match

      return {
        score: confidence,
        breakdown: {
          aiConfidence: confidence,
        },
        reasons: aiResult.reasons || [
          `AI confidence: ${(confidence * 100).toFixed(1)}%`,
        ],
        isExactMatch,
      };
    } catch (error) {
      this.logger.error(
        `AI matching failed for cases ${foundCaseId} and ${lostCaseId}:`,
        error,
      );
      // Fallback: return low score if AI fails
      return {
        score: 0,
        breakdown: { aiError: 0 },
        reasons: ['AI matching service unavailable'],
        isExactMatch: false,
      };
    }
  }

  /**
   * Find matches for a verified found document case
   */
  async findMatchesForFoundCase(foundCaseId: string): Promise<void> {
    this.logger.log(`Finding matches for found case ${foundCaseId}`);

    // Get the found case with document details
    const foundCase = await this.prismaService.documentCase.findUnique({
      where: { id: foundCaseId },
      include: {
        document: {
          include: {
            type: true,
          },
        },
        foundDocumentCase: true,
      },
    });

    if (!foundCase?.foundDocumentCase) {
      throw new NotFoundException('Found document case not found');
    }

    if (
      foundCase.foundDocumentCase.status !== FoundDocumentCaseStatus.VERIFIED
    ) {
      this.logger.warn(
        `Found case ${foundCaseId} is not VERIFIED, skipping matching`,
      );
      return;
    }

    if (!foundCase.document) {
      throw new NotFoundException('Found document case has no document');
    }

    // Find all SUBMITTED lost cases with the same document type
    const lostCases = await this.prismaService.documentCase.findMany({
      where: {
        lostDocumentCase: {
          isNot: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          status: LostDocumentCaseStatus.SUBMITTED as any,
        },
        document: {
          typeId: foundCase.document.typeId,
        },
        voided: false,
      },
      include: {
        lostDocumentCase: {
          include: {
            matches: {
              where: {
                foundDocumentCaseId: foundCase.foundDocumentCase.id,
                voided: false,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Found ${lostCases.length} potential lost cases to match against`,
    );

    // Calculate match scores for each lost case
    const matchPromises = lostCases.map(async (lostCase) => {
      // Skip if match already exists or no lostDocumentCase
      if (
        !lostCase.lostDocumentCase ||
        lostCase.lostDocumentCase.matches?.length > 0
      ) {
        return null;
      }

      const matchResult = await this.calculateMatchScore(
        foundCaseId,
        lostCase.id,
      );

      if (
        matchResult.score >= MATCH_THRESHOLD &&
        lostCase.lostDocumentCase &&
        foundCase.foundDocumentCase
      ) {
        return {
          lostCaseId: lostCase.id,
          lostDocumentCaseId: lostCase.lostDocumentCase.id,
          foundDocumentCaseId: foundCase.foundDocumentCase.id,
          score: matchResult.score,
          reasons: matchResult.reasons,
          breakdown: matchResult.breakdown,
        };
      }

      return null;
    });

    const potentialMatches = (await Promise.all(matchPromises)).filter(
      (m): m is NonNullable<typeof m> => m !== null,
    );

    this.logger.log(
      `Found ${potentialMatches.length} matches above threshold ${MATCH_THRESHOLD}`,
    );

    // Create match records
    for (const match of potentialMatches) {
      await this.prismaService.match.create({
        data: {
          lostDocumentCaseId: match.lostDocumentCaseId,
          foundDocumentCaseId: match.foundDocumentCaseId,
          matchScore: match.score,
          status: MatchStatus.PENDING,
          aiAnalysis: {
            reasons: match.reasons,
            breakdown: match.breakdown,
            isExactMatch: match.score >= 0.9,
          },
          aiModel: 'gemini-2.5-flash',
          matchNumber: uuidv4(),
        },
      });

      // TODO: Send notifications to both users
      this.logger.log(
        `Created match between lost case ${match.lostCaseId} and found case ${foundCaseId} with score ${match.score}`,
      );
    }
  }

  /**
   * Find matches for a submitted lost document case
   */
  async findMatchesForLostCase(lostCaseId: string): Promise<void> {
    this.logger.log(`Finding matches for lost case ${lostCaseId}`);

    const lostCase = await this.prismaService.documentCase.findUnique({
      where: { id: lostCaseId },
      include: {
        document: {
          include: {
            type: true,
          },
        },
        lostDocumentCase: true,
      },
    });

    if (!lostCase?.lostDocumentCase) {
      throw new NotFoundException('Lost document case not found');
    }

    if (lostCase.lostDocumentCase.status !== LostDocumentCaseStatus.SUBMITTED) {
      this.logger.warn(
        `Lost case ${lostCaseId} is not SUBMITTED, skipping matching`,
      );
      return;
    }

    if (!lostCase.document) {
      throw new NotFoundException('Lost document case has no document');
    }

    // Find all VERIFIED found cases with the same document type
    const foundCases = await this.prismaService.documentCase.findMany({
      where: {
        foundDocumentCase: {
          isNot: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          status: FoundDocumentCaseStatus.VERIFIED as any,
        },
        document: {
          typeId: lostCase.document.typeId,
        },
        voided: false,
      },
      include: {
        foundDocumentCase: {
          include: {
            matches: {
              where: {
                lostDocumentCaseId: lostCase.lostDocumentCase.id,
                voided: false,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Found ${foundCases.length} potential found cases to match against`,
    );

    // Calculate match scores and create matches
    for (const foundCase of foundCases) {
      // Skip if match already exists or no foundDocumentCase
      if (
        !foundCase.foundDocumentCase ||
        foundCase.foundDocumentCase.matches?.length > 0
      ) {
        continue;
      }

      const matchResult = await this.calculateMatchScore(
        foundCase.id,
        lostCaseId,
      );

      if (matchResult.score >= MATCH_THRESHOLD && lostCase.lostDocumentCase) {
        await this.prismaService.match.create({
          data: {
            lostDocumentCaseId: lostCase.lostDocumentCase.id,
            foundDocumentCaseId: foundCase.foundDocumentCase.id,
            matchScore: matchResult.score,
            status: MatchStatus.PENDING,
            aiAnalysis: {
              reasons: matchResult.reasons,
              breakdown: matchResult.breakdown,
              isExactMatch: matchResult.isExactMatch,
            },
            aiModel: 'gemini-2.5-flash',
            matchNumber: uuidv4(),
          },
        });

        // TODO: Send notifications
        this.logger.log(
          `Created match between lost case ${lostCaseId} and found case ${foundCase.id} with score ${matchResult.score}`,
        );
      }
    }
  }

  /**
   * Get all matches with filtering and pagination
   */
  async findAll(query: QueryMatchesDto, originalUrl: string): Promise<any> {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.match.findMany
    > = {
      where: {
        lostDocumentCaseId: query.lostDocumentCaseId,
        foundDocumentCaseId: query.foundDocumentCaseId,
        status: query.status as MatchStatus | undefined,
        matchScore: {
          gte: query.minMatchScore,
          lte: query.maxMatchScore,
        },
        // adminVerified: query.adminVerified,
        voided: false,
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };

    const [data, totalCount] = await Promise.all([
      this.prismaService.match.findMany(dbQuery),
      this.prismaService.match.count(pick(dbQuery, 'where')),
    ]);

    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  /**
   * Get a single match by ID
   */
  async findOne(
    id: string,
    query?: CustomRepresentationQueryDto,
  ): Promise<any> {
    const match = await this.prismaService.match.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  /**
   * Accept a match (by lost document owner)
   */
  async acceptMatch(
    id: string,
    acceptMatchDto: AcceptMatchDto,
    userId: string,
  ): Promise<any> {
    const match = await this.prismaService.match.findUnique({
      where: { id },
      include: {
        lostDocumentCase: {
          include: {
            case: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.lostDocumentCase.case.userId !== userId) {
      throw new BadRequestException(
        'You can only accept matches for your own lost documents',
      );
    }

    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(
        `Cannot accept match with status ${match.status}`,
      );
    }

    return await this.prismaService.match.update({
      where: { id },
      data: {
        status: MatchStatus.PENDING,
      },
      ...this.representationService.buildCustomRepresentationQuery(),
    });
  }

  /**
   * Reject a match
   */
  async rejectMatch(
    id: string,
    rejectMatchDto: RejectMatchDto,
    userId: string,
  ): Promise<any> {
    const match = await this.prismaService.match.findUnique({
      where: { id },
      include: {
        lostDocumentCase: {
          include: {
            case: true,
          },
        },
        foundDocumentCase: {
          include: {
            case: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const isLostOwner = match.lostDocumentCase.case.userId === userId;
    const isFoundOwner = match.foundDocumentCase.case.userId === userId;

    if (!isLostOwner && !isFoundOwner) {
      throw new BadRequestException(
        'You can only reject matches for your own documents',
      );
    }

    if (match.status === MatchStatus.CLAIMED) {
      throw new BadRequestException('Cannot reject a completed match');
    }

    return await this.prismaService.match.update({
      where: { id },
      data: {
        status: MatchStatus.REJECTED,
      },
    });
  }

  /**
   * Complete a match (handover completed)
   */
  async completeMatch(
    id: string,
    completeMatchDto: CompleteMatchDto,
    userId: string,
  ): Promise<any> {
    const match = await this.prismaService.match.findUnique({
      where: { id },
      include: {
        lostDocumentCase: {
          include: {
            case: true,
          },
        },
        foundDocumentCase: {
          include: {
            case: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestException(
        `Cannot complete match with status ${match.status}. Match must be ACCEPTED`,
      );
    }

    // Update match status
    const updatedMatch = await this.prismaService.match.update({
      where: { id },
      data: {
        status: MatchStatus.CLAIMED,
      },
    });

    // Update both case statuses to COMPLETED
    await Promise.all([
      this.caseStatusTransitionsService.transitionStatus(
        match.lostDocumentCase.caseId,
        LostDocumentCaseStatus.COMPLETED,
        ActorType.USER,
        userId,
      ),
      this.caseStatusTransitionsService.transitionStatus(
        match.foundDocumentCase.caseId,
        FoundDocumentCaseStatus.COMPLETED,
        ActorType.USER,
        userId,
      ),
    ]);

    // Award points to finder
    const foundCase = await this.prismaService.foundDocumentCase.findUnique({
      where: { id: match.foundDocumentCaseId },
      include: {
        case: {
          include: {
            document: {
              include: {
                type: true,
              },
            },
          },
        },
      },
    });

    if (foundCase?.case.document?.type) {
      await this.prismaService.foundDocumentCase.update({
        where: { id: match.foundDocumentCaseId },
        data: {
          pointAwarded: foundCase.case.document.type.loyaltyPoints,
        },
      });
    }

    return updatedMatch;
  }

  /**
   * Admin verify a match
   */
  async adminVerifyMatch(
    id: string,
    _adminVerifyDto: AdminVerifyMatchDto,
    _adminUserId: string,
  ): Promise<any> {
    const match = await this.prismaService.match.findUnique({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return await this.prismaService.match.update({
      where: { id },
      data: {
        // adminVerified: adminVerifyDto.verified,
        // verifiedBy: adminVerifyDto.verified ? adminUserId : null,
      },
    });
  }

  /**
   * Delete/void a match
   */
  async remove(
    id: string,
    query: DeleteQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string, // Reserved for future authorization checks
  ): Promise<any> {
    if (query?.purge) {
      return await this.prismaService.match.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }

    return await this.prismaService.match.update({
      where: { id },
      data: { voided: true },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
