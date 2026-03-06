/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { pick } from 'lodash';
import {
  FoundDocumentCase,
  Match,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../common/query-builder';
import {
  QueryMatchesDto,
  QueryMatchesForFoundCaseDto,
  QueryMatchesForLostCaseDto,
} from './matching.dto';
import { UserSession } from 'src/auth/auth.types';
import { isSuperUser } from 'src/app.utils';
import { MatchingStatusTransitionService } from './matching.transitions.service';
import { StatusTransitionReasonsDto } from 'src/status-transitions/status-transitions.dto';
import { MatchingVectorSearchService } from './matching.vector-search';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly defaultRep =
    'custom:select(id,matchNumber,status,createdAt,updatedAt,aiVerificationResult,foundDocumentCase:select(case:select(userId,document:select(images:select(blurredUrl)))),lostDocumentCase:select(case:select(userId,document:select(images:select(blurredUrl)))))';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly matchTransitionsService: MatchingStatusTransitionService,
    private readonly matchingVectorSearchService: MatchingVectorSearchService,
  ) {}

  reject(
    matchId: string,
    rejectDto: StatusTransitionReasonsDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    return this.matchTransitionsService.reject(matchId, rejectDto, user, query);
  }

  queryMatchesForLostDocumentCase(query: QueryMatchesForLostCaseDto) {
    return this.matchingVectorSearchService.findSimilarFoundDocumentCasesForLostDocumentCase(
      query,
    );
  }
  queryMatchesForFoundDocumentCase(query: QueryMatchesForFoundCaseDto) {
    return this.matchingVectorSearchService.findSimilarLostDocumentCasesForFoundDocumentCase(
      query,
    );
  }

  private mapMatch(d: Match & { foundDocumentCase: FoundDocumentCase }) {
    const aiVerificationResult = (d.aiVerificationResult ?? {}) as Record<
      string,
      any
    >;
    return {
      ...pick(d, [
        'id',
        'matchNumber',
        'aiScore',
        'status',
        // 'foundDocumentCase',
        'lostDocumentCase',
        'createdAt',
        'updatedAt',
      ]),
      aiVerificationResult: {
        ...pick(aiVerificationResult, ['verdict', 'fieldAnalysis']),
        fieldAnalysis: (
          aiVerificationResult.fieldAnalysis as Array<Record<string, any>>
        ).map((f) => pick(f, ['field', 'match'])),
      },
      foundDocumentCase: {
        ...d.foundDocumentCase,
      },
    };
  }

  async findAll(
    query: QueryMatchesDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.match.findMany
    > = {
      where: {
        AND: [
          {
            voided: query?.includeVoided ? undefined : false,
          },
          {
            OR: query.search
              ? [
                  {
                    foundDocumentCase: {
                      case: {
                        document: {
                          fullName: {
                            contains: query.search,
                            mode: Prisma.QueryMode.insensitive,
                          },
                        },
                      },
                    },
                  },
                  {
                    foundDocumentCase: {
                      case: {
                        document: {
                          documentNumber: {
                            contains: query.search,
                            mode: Prisma.QueryMode.insensitive,
                          },
                        },
                      },
                    },
                  },
                  {
                    lostDocumentCase: {
                      case: {
                        document: {
                          fullName: {
                            contains: query.search,
                            mode: Prisma.QueryMode.insensitive,
                          },
                        },
                      },
                    },
                  },
                  {
                    lostDocumentCase: {
                      case: {
                        document: {
                          documentNumber: {
                            contains: query.search,
                            mode: Prisma.QueryMode.insensitive,
                          },
                        },
                      },
                    },
                  },
                ]
              : undefined,
          },
          {
            OR: query.documentCaseId
              ? [
                  {
                    foundDocumentCase: {
                      caseId: query.documentCaseId,
                    },
                  },
                  {
                    lostDocumentCase: {
                      caseId: query.documentCaseId,
                    },
                  },
                ]
              : undefined,
          },
          {
            OR:
              isAdmin && query.userId
                ? [
                    {
                      foundDocumentCase: {
                        case: {
                          userId: query.userId,
                        },
                      },
                    },
                    {
                      lostDocumentCase: {
                        case: {
                          userId: query.userId,
                        },
                      },
                    },
                  ]
                : undefined,
          },
          {
            OR: !isAdmin
              ? [
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
                ]
              : undefined,
          },
          {
            OR: query.lostDocumentCase
              ? [
                  {
                    lostDocumentCase: {
                      id: query.lostDocumentCase,
                    },
                  },
                  {
                    lostDocumentCase: {
                      case: {
                        caseNumber: query.lostDocumentCase,
                      },
                    },
                  },
                ]
              : undefined,
          },
          {
            OR: query.foundDocumentCase
              ? [
                  {
                    foundDocumentCase: {
                      id: query.foundDocumentCase,
                    },
                  },
                  {
                    foundDocumentCase: {
                      case: {
                        caseNumber: query.foundDocumentCase,
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
      this.prismaService.match.findMany(dbQuery),
      this.prismaService.match.count(pick(dbQuery, 'where')),
    ]);
    return {
      results: isAdmin
        ? data
        : data.map((d) => {
            return this.mapMatch(d as any);
          }),
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
    const data = await this.prismaService.match.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(
        isAdmin ? (query?.v ?? this.defaultRep) : this.defaultRep,
      ),
    });
    if (!data) throw new NotFoundException('Document type not found');
    return isAdmin ? data : this.mapMatch(data as any);
  }

  async remove(id: string, query: DeleteQueryDto) {
    let data: Match;
    if (query?.purge) {
      data = await this.prismaService.match.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.match.update({
        where: { id },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  async restore(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prismaService.match.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }
}
