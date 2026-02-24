import { Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import { pick } from 'lodash';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { QueryDocumentCaseDto } from './document-cases.dto';
import { UserSession } from '../auth/auth.types';
import { isSuperUser } from 'src/app.utils';

@Injectable()
export class DocumentCasesQueryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}
  async findAll(
    query: QueryDocumentCaseDto,
    user: UserSession['user'],
    originalUrl: string,
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.documentCase.findMany
    > = {
      where: {
        AND: [
          {
            voided: query?.includeVoided ? undefined : false,
            userId: isAdmin ? query?.userId : user.id, // only admin users can view all cases
            document: {
              typeId: query.documentType,
              serialNumber: query.documentNumber,
              issuer: { contains: query.documentIssuer },
              ownerName: { contains: query.ownerName },
              expiryDate: {
                gte: query.docuemtExpiryDateFrom
                  ? dayjs(query.docuemtExpiryDateFrom).toDate()
                  : undefined,
                lte: query.docuemtExpiryDateTo
                  ? dayjs(query.docuemtExpiryDateTo).toDate()
                  : undefined,
              },
              issuanceDate: {
                gte: query.docuemtIssueDateFrom
                  ? dayjs(query.docuemtIssueDateFrom).toDate()
                  : undefined,
                lte: query.docuemtIssueDateTo
                  ? dayjs(query.docuemtIssueDateTo).toDate()
                  : undefined,
              },
            },
            address: {
              level1: query.level1,
              level2: query.level2,
              level3: query.level3,
              level4: query.level4,
              level5: query.level5,
              country: query.country,
              postalCode: query.postalCode,
            },
            foundDocumentCase:
              query.caseType === 'FOUND' ? { isNot: null } : undefined,
            lostDocumentCase:
              query.caseType === 'LOST' ? { isNot: null } : undefined,
            eventDate: query.eventDateFrom
              ? {
                  gte: dayjs(query.eventDateFrom).toDate(),
                  lte: dayjs(query.eventDateTo).toDate(),
                }
              : undefined,
            createdAt: query.dateReportedFrom
              ? {
                  gte: dayjs(query.dateReportedFrom).toDate(),
                  lte: dayjs(query.dateReportedTo).toDate(),
                }
              : undefined,
            caseNumber: query.caseNumber,
          },
          {
            OR: query.search
              ? [
                  {
                    document: {
                      serialNumber: {
                        contains: query?.search,
                        mode: 'insensitive',
                      },
                    },
                  },
                  {
                    document: {
                      ownerName: {
                        contains: query?.search,
                        mode: 'insensitive',
                      },
                    },
                  },
                  {
                    caseNumber: {
                      contains: query?.search,
                      mode: 'insensitive',
                    },
                  },
                ]
              : undefined,
          },
          {
            address: {
              OR: query.location
                ? [
                    {
                      label: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      id: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      address1: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      address2: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      cityVillage: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      country: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      formatted: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      label: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      landmark: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      level1: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      level2: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      level3: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      level4: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      level5: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      plusCode: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                    {
                      postalCode: {
                        contains: query.location,
                        mode: 'insensitive',
                      },
                    },
                  ]
                : undefined,
            },
          },
        ],
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.documentCase.findMany(dbQuery),
      this.prismaService.documentCase.count(pick(dbQuery, 'where')),
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
   * Checks if the claimant is a verified owner of the document case by
   * if the latest claim is verified and belongs to the user
   * @param caseId
   * @param userId
   * @returns
   */
  private async isClaimantAVerifiedOwner(caseId: string, userId: string) {
    const verifiedOwner = await this.prismaService.claim.findFirst({
      where: {
        status: 'VERIFIED',
        userId,
        match: {
          lostDocumentCase: {
            case: {
              userId, // User reported the doc as a lost case
            },
          },
          foundDocumentCase: {
            caseId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return verifiedOwner;
  }

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const isVerifiedOwner = await this.isClaimantAVerifiedOwner(id, user.id);
    const data = await this.prismaService.documentCase.findUnique({
      where: { id, userId: isAdmin || isVerifiedOwner ? undefined : user.id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Document case not found');
    return data;
  }
}
