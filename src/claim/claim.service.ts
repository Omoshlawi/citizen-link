import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { normalizeString, parseDate } from '../app.utils';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClaimDto, QueryClaimDto } from './claim.dto';
import { SecurityQuestionsDto } from '../extraction/extraction.dto';
import { S3Service } from '../s3/s3.service';
import { ClaimStatusTransitionService } from './claim.transitions.service';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { HumanIdService } from '../human-id/human-id.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { MatchStatus } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);
  private readonly defaultRep =
    'custom:include(verification,attachments,foundDocumentCase:select(caseId),handover)';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly s3Service: S3Service,
    private readonly claimStatusTransitionService: ClaimStatusTransitionService,
    private readonly humanIdService: HumanIdService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  private async validateMatch(matchId: string, userId: string) {
    const match = await this.prismaService.match.findUnique({
      where: {
        id: matchId,
        lostDocumentCase: {
          case: {
            userId,
          },
        },
      },
      include: {
        foundDocumentCase: {
          include: {
            case: true,
          },
        },
      },
    });
    if (!match) {
      this.logger.error(
        `No match found. Must be a valid match and lost case must be reported bu user raising a claim`,
      );
      throw new BadRequestException(
        `Invalid Match. only document owner can claim the match`,
      );
    }
    return match;
  }

  private async _verify(
    claimId: string,
    securityQuestions: SecurityQuestionsDto['questions'] = [],
    userResponse: CreateClaimDto['securityQuestions'] = [],
  ) {
    const allCorrect = securityQuestions.every((sq) => {
      const res = userResponse.find(
        (ur) => normalizeString(ur.question) === normalizeString(sq.question),
      )?.response;
      if (!res) return false;
      this.logger.debug(`Nomalized ${res} to ${normalizeString(res)}`);
      this.logger.debug(
        `Nomalized ${sq.answer} to ${normalizeString(sq.answer)}`,
      );
      return normalizeString(res) === normalizeString(sq.answer);
    });
    await this.prismaService.claim.update({
      where: { id: claimId },
      data: {
        // status: '',
        verification: {
          create: {
            userResponses: userResponse,
            passed: allCorrect,
          },
        },
      },
    });
  }

  private async validateAttachments(
    attachments: CreateClaimDto['attachments'],
  ): Promise<void> {
    // Validate files if xist and are images
    this.logger.debug('Checking if attachments exist', attachments);
    const exists = await Promise.all(
      attachments.map((image) => this.s3Service.fileExists(image, 'tmp')),
    );
    const allExists = exists.every(Boolean);
    if (!allExists) {
      throw new BadRequestException('One or more attachments do not exist');
    }
    this.logger.debug('All attachments exist');
    // move files
  }

  /**
   * Prevent multiple claims on same match
   * Only allow new claim if latest previous claim is cancelled for some supported Reason
   * @param matchId
   */
  private async assertNoOtherClaimOrLatestClaimIsCancelled(matchId: string) {
    const existingClaim = await this.prismaService.claim.findFirst({
      where: {
        matchId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (existingClaim && existingClaim.status !== 'CANCELLED') {
      throw new BadRequestException('A claim already exists for this match');
    }
  }

  async create(
    { attachments, securityQuestions, ...createClaimDto }: CreateClaimDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const match = await this.validateMatch(createClaimDto.matchId, user.id);
    await this.validateAttachments(attachments);
    // Ensure their is no other claim with same match urther than latest cancelled claim
    await this.assertNoOtherClaimOrLatestClaimIsCancelled(
      createClaimDto.matchId,
    );
    // Create Claim
    const claim = await this.prismaService.claim.create({
      data: {
        ...createClaimDto,
        claimNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.CLAIM,
        }),
        userId: user.id,
        foundDocumentCaseId: match.foundDocumentCaseId,
      },
    });

    // Verify security questions
    await this._verify(
      claim.id,
      [], //match.securityQuestions as any,
      securityQuestions,
    );
    // Move files
    const keys = await Promise.all(
      attachments.map(async (attachment) => {
        const toDir = `${match.foundDocumentCase.case.caseNumber}/claims/${claim.claimNumber}`;
        await this.s3Service.moveFileToCasesBucket(attachment, toDir);
        return `${toDir}/${attachment}`;
      }),
    );
    // Add attachments to the claim and update match status to claimed
    await this.prismaService.claim.update({
      where: { id: claim.id },
      data: {
        attachments: {
          createMany: {
            skipDuplicates: true,
            data: keys.map((attachment) => ({
              storageKey: attachment,
              uploadedById: user.id,
            })),
          },
        },
      },
    });

    // Transition match to claimed if not already claimed
    if (match.status !== MatchStatus.CLAIMED) {
      await this.prismaService.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: match.id },
          data: {
            status: MatchStatus.CLAIMED,
          },
        });
        const reason = await tx.transitionReason.findUnique({
          where: {
            entityType_fromStatus_toStatus_code: {
              entityType: 'Match',
              fromStatus: match.status,
              toStatus: MatchStatus.CLAIMED,
              code: 'CLAIM_CREATED',
            },
            auto: true,
          },
        });
        if (!reason)
          throw new BadRequestException(
            `Match transition reason from ${match.status} to ${MatchStatus.CLAIMED} not found`,
          );
        await tx.statusTransition.create({
          data: {
            entityType: 'Match',
            entityId: match.id,
            fromStatus: match.status,
            toStatus: MatchStatus.CLAIMED,
            changedById: user.id,
            comment: 'Claim created',
            reasonId: reason.id,
          },
        });
      });
    }

    // Return created claim
    return await this.findOne(claim.id, query, user);
  }

  async findAll(
    query: QueryClaimDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { claim: ['list-any'] } },
    });
    const dbQuery: Prisma.ClaimWhereInput = {
      AND: [
        {
          claimNumber: query.claimNumber,
          matchId: query.matchId,
          status: query.status,
          userId: isAdmin ? query.userId : user.id,
          createdAt: {
            lte: parseDate(query.createdAtTo),
            gte: parseDate(query.createdAtFrom),
          },
          foundDocumentCaseId: query.foundDocumentCaseId,
        },
        {
          OR: query.search
            ? [
                {
                  claimNumber: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ]
            : undefined,
        },
        {
          OR: query.caseId
            ? [
                {
                  foundDocumentCase: {
                    caseId: query.caseId,
                  },
                },
                {
                  match: {
                    lostDocumentCase: {
                      caseId: query.caseId,
                    },
                  },
                },
              ]
            : undefined,
        },
      ],
    };
    const totalCount = await this.prismaService.claim.count({ where: dbQuery });
    const data = await this.prismaService.claim.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.representationService.buildCustomRepresentationQuery(
        isAdmin ? (query?.v ?? this.defaultRep) : this.defaultRep,
      ),
      ...this.sortService.buildSortQuery(query?.orderBy),
    });
    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { claim: ['list-any'] } },
    });
    const data = await this.prismaService.claim.findUnique({
      where: {
        id,
        match: {
          OR: isAdmin
            ? undefined
            : [
                {
                  foundDocumentCase: {
                    case: {
                      userId: user.id,
                    },
                  },
                },
                {
                  lostDocumentCase: {
                    case: {
                      userId: user.id,
                    },
                  },
                },
              ],
        },
      },
      ...this.representationService.buildCustomRepresentationQuery(
        isAdmin ? (query?.v ?? this.defaultRep) : this.defaultRep,
      ),
    });
    if (!data) throw new NotFoundException('Claim not found');
    return data;
  }

  async reject(
    claimId: string,
    rejectDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
    underReview: boolean = false,
  ) {
    return this.claimStatusTransitionService.reject(
      claimId,
      rejectDto,
      user,
      query,
      underReview,
    );
  }

  async verify(
    claimId: string,
    verifyDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
    underReview: boolean = false,
  ) {
    return this.claimStatusTransitionService.verify(
      claimId,
      verifyDto,
      user,
      query,
      underReview,
    );
  }

  async cancel(
    claimId: string,
    cancelDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    return this.claimStatusTransitionService.cancel(
      claimId,
      cancelDto,
      user,
      query,
    );
  }

  async dispute(
    claimId: string,
    disputeDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    return this.claimStatusTransitionService.dispute(
      claimId,
      disputeDto,
      user,
      query,
    );
  }

  async reviewDispute(
    claimId: string,
    reviewDisputeDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    return this.claimStatusTransitionService.reviewDispute(
      claimId,
      reviewDisputeDto,
      user,
      query,
    );
  }
}
