import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  ExchangeDirection,
  ExchangeStatus,
  Prisma,
} from '../../generated/prisma/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  RepresentationOptions,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import {
  QueryExchangeDto,
  WithdrawScheduleQueryDto,
} from './document-exchange.dto';

@Injectable()
export class DocumentExchangeQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
    private readonly representation: CustomRepresentationService,
    private readonly sort: SortService,
    private readonly auth: AuthService<BetterAuthWithPlugins>,
  ) {}

  async findAll(
    query: QueryExchangeDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const [{ success: isAdmin }, { success: isStaff }] = await Promise.all([
      this.auth.api.userHasPermission({
        body: { userId: user.id, permission: { handover: ['manage-any'] } },
      }),
      this.auth.api.userHasPermission({
        body: { userId: user.id, permission: { documentCase: ['collect'] } },
      }),
    ]);
    const canSeeAll = isAdmin || isStaff;
    // Staff/admin must not see the code via the API — they receive it verbally from
    // the participant. Participants only see their own exchanges (scoped by WHERE below).
    const repOptions: RepresentationOptions = {
      denyPatterns: canSeeAll ? ['**.code'] : [],
      autoOmit: canSeeAll
        ? { '**.verifications': ['code', 'exchange'] }
        : undefined,
    };

    const dbQuery: Prisma.DocumentExchangeWhereInput = {
      direction: query.direction,
      method: query.method,
      ...(query.status
        ? { status: query.status }
        : query.active
          ? {
              status: {
                in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS],
              },
            }
          : {}),
      foundCaseId: query.foundCaseId,
      claimId: query.claimId,
      ...(canSeeAll
        ? {}
        : {
            OR: [
              {
                direction: ExchangeDirection.INBOUND,
                foundCase: { case: { userId: user.id } },
              },
              { claim: { userId: user.id } },
            ],
          }),
    };

    const totalCount = await this.prisma.documentExchange.count({
      where: dbQuery,
    });
    const data = await this.prisma.documentExchange.findMany({
      where: dbQuery,
      ...this.pagination.buildSafePaginationQuery(query, totalCount),
      ...this.representation.buildCustomRepresentationQuery(
        query?.v,
        repOptions,
      ),
      ...this.sort.buildSortQuery(query?.orderBy),
    });

    return {
      results: data,
      ...this.pagination.buildPaginationControls(
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
    const [{ success: isAdmin }, { success: isStaff }] = await Promise.all([
      this.auth.api.userHasPermission({
        body: { userId: user.id, permission: { handover: ['manage-any'] } },
      }),
      this.auth.api.userHasPermission({
        body: { userId: user.id, permission: { documentCase: ['collect'] } },
      }),
    ]);
    const canSeeAll = isAdmin || isStaff;
    const repOptions: RepresentationOptions = {
      denyPatterns: canSeeAll ? ['**.code'] : [],
      autoOmit: canSeeAll
        ? { '**.verifications': ['code', 'exchange'] }
        : undefined,
    };
    const exchange = await this.prisma.documentExchange.findUnique({
      where: {
        id,
        ...(canSeeAll
          ? {}
          : {
              OR: [
                {
                  direction: ExchangeDirection.INBOUND,
                  foundCase: { case: { userId: user.id } },
                },
                { claim: { userId: user.id } },
              ],
            }),
      },
      ...this.representation.buildCustomRepresentationQuery(
        query?.v,
        repOptions,
      ),
    });
    if (!exchange) throw new NotFoundException('Exchange not found');
    return exchange;
  }

  getActiveExchange(
    query: WithdrawScheduleQueryDto & { exchangeNumber?: string },
  ) {
    return this.prisma.documentExchange.findFirst({
      where: {
        direction: query.direction,
        foundCaseId:
          query.direction === ExchangeDirection.INBOUND
            ? query.foundCaseId
            : undefined,
        claimId:
          query.direction === ExchangeDirection.OUTBOUND
            ? query.claimId
            : undefined,
        exchangeNumber:
          query.direction === ExchangeDirection.OUTBOUND
            ? query.exchangeNumber
            : undefined,
        status: { in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        verifications: { orderBy: { createdAt: 'desc' } },
        foundCase: {
          include: {
            case: {
              include: {
                document: { include: { type: true } },
                user: true,
              },
            },
          },
        },
        claim: { include: { user: true, match: true, invoice: true } },
      },
    });
  }
}
