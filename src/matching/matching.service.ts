/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { pick } from 'lodash';
import { Match, Prisma } from '../../generated/prisma/client';
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
  QueryMatechesForFoundCaseDto,
  QueryMatechesForLostCaseDto,
} from './matching.dto';
import { MatchFoundDocumentService } from './matching.found.service';
import { FindMatchesOptions, VerifyMatchesOptions } from './matching.interface';
import { MatchLostDocumentService } from './matching.lost.service';
import { MatchingStatisticsService } from './matching.statistics.service';
import { UserSession } from 'src/auth/auth.types';
import { isSuperUser } from 'src/app.utils';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly matchFoundDocumentService: MatchFoundDocumentService,
    private readonly matchLostDocumentService: MatchLostDocumentService,
    private readonly matchingStatistics: MatchingStatisticsService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  getMatchStatistics(
    documentId: string,
    isLostDocument: boolean,
    options: { similarityThreshold?: number } = {},
  ) {
    return this.matchingStatistics.getMatchStatistics(
      documentId,
      isLostDocument,
      options,
    );
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

  queryMatchesForLostDocumentCase(query: QueryMatechesForLostCaseDto) {
    return this.matchFoundDocumentService.queryMatchesForLostDocumentCase(
      query,
    );
  }
  queryMatchesForFoundDocumentCase(query: QueryMatechesForFoundCaseDto) {
    return this.matchLostDocumentService.queryMatchesForFoundDocumentCase(
      query,
    );
  }

  async findAll(
    query: QueryMatchesDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const rep =
      'custom:select(id,matchNumber,matchScore,status,createdAt,updatedAt,aiAnalysis,foundDocumentCase:select(case:select(document:select(images:select(blurredUrl)))),lostDocumentCase:select(case:select(document:select(images:select(blurredUrl)))))';
    const isAdmin = isSuperUser(user);
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.match.findMany
    > = {
      where: {
        AND: [
          {
            voided: query?.includeVoided ? undefined : false,
            lostDocumentCaseId: query?.lostDocumentCaseId,
            foundDocumentCaseId: query?.foundDocumentCaseId,
            matchScore: { gte: query.minMatchScore, lte: query.maxMatchScore },
          },
          {
            OR: query.search
              ? [
                  {
                    foundDocumentCase: {
                      case: {
                        document: {
                          ownerName: {
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
                          ownerName: {
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
        ],
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(
        isAdmin ? (query?.v ?? rep) : rep,
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
            const aiAnalysis = (d.aiAnalysis ?? {}) as Record<string, any>;
            return {
              ...pick(d, [
                'id',
                'matchNumber',
                'matchScore',
                'status',
                'foundDocumentCase',
                'lostDocumentCase',
                'createdAt',
                'updatedAt',
              ]),
              aiAnalysis: pick(aiAnalysis, [
                'overallScore',
                'confidence',
                'recommendation',
              ]),
            };
          }),
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async findOne(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prismaService.match.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Document type not found');
    return data;
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
