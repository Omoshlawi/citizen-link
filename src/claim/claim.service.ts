/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { pick } from 'lodash';
import { isSuperUser, normalizeString, parseDate } from '../app.utils';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClaimDto, QueryClaimDto, UpdateClaimDto } from './claim.dto';
import { SecurityQuestionsDto } from '../extraction/extraction.dto';
import { S3Service } from '../s3/s3.service';
import { ClaimStatusTransitionService } from './claim.transitions.service';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import { HumanIdService } from '../human-id/human-id.service';
import { EntityPrefix } from '../human-id/human-id.constants';

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);
  private readonly defaultRep =
    'custom:include(verification,attachments,foundDocumentCase:select(caseId))';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly s3Service: S3Service,
    private readonly claimStatusTransitionService: ClaimStatusTransitionService,
    private readonly humanIdService: HumanIdService,
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
        foundDocumentCase: true,
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
    {
      attachments,
      securityQuestions,
      pickupStationId,
      addressId,
      ...createClaimDto
    }: CreateClaimDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    if (!pickupStationId && !addressId) {
      throw new BadRequestException(
        'Either pickupStationId or addressId must be provided',
      );
    }
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
        pickupStationId,
        pickupAddressId: addressId,
        preferredHandoverDate: parseDate(createClaimDto.preferredHandoverDate),
      },
    });
    // Verify security questions
    await this._verify(
      claim.id,
      match.foundDocumentCase.securityQuestion as any,
      securityQuestions,
    );
    // Move files
    const keys = await Promise.all(
      attachments.map(async (attachment) => {
        const toDir = `${match.foundDocumentCase.caseId}/claims/${claim.claimNumber}`;
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
        match: {
          update: {
            where: { id: match.id },
            data: {
              status: 'CLAIMED',
            },
          },
        },
      },
    });

    // Return created claim
    return await this.findOne(claim.id, query, user);
  }

  async findAll(
    query: QueryClaimDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.claim.findMany
    > = {
      where: {
        AND: [
          {
            claimNumber: query.claimNumber,
            matchId: query.matchId,
            pickupStationId: query.pickupStationId,
            status: query.status,
            preferredHandoverDate: {
              gte: parseDate(query.preferredHandoverDateFrom),
              lte: parseDate(query.preferredHandoverDateTo),
            },
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
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(
        isAdmin ? (query?.v ?? this.defaultRep) : this.defaultRep,
      ),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.claim.findMany(dbQuery),
      this.prismaService.claim.count(pick(dbQuery, 'where')),
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

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
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

  update(
    id: string,
    updateClaimDto: UpdateClaimDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prismaService.claim.update({
      where: { id },
      data: updateClaimDto,
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async reject(
    claimId: string,
    rejectDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    return this.claimStatusTransitionService.reject(
      claimId,
      rejectDto,
      user,
      query,
    );
  }

  async verify(
    claimId: string,
    verifyDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    return this.claimStatusTransitionService.verify(
      claimId,
      verifyDto,
      user,
      query,
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
}
