import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { Prisma } from '../../generated/prisma/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStaffOperationScopeDto,
  QueryStaffOperationsScopeDto,
} from './staff-operation-scope.dto';

@Injectable()
export class StaffOperationScopeService {
  private readonly defaultRep =
    'custom:include(user:select(id,name),station,operationType,grantedBy:select(id,name))';
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  async findAll(
    query: QueryStaffOperationsScopeDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: hasGlobalView } =
      await this.authService.api.userHasPermission({
        body: {
          userId: user.id,
          permission: { staffOperationScope: ['view'] },
        },
      });
    const dbQuery: Prisma.StaffStationOperationWhereInput = {
      AND: [
        {
          voided: query.includeVoided ? undefined : false,
          userId: hasGlobalView ? query.userId : user.id,
          stationId: query.stationId,
          operationTypeId: query.operationTypeId,
          operationType: {
            isFinalOperation: query.isFinalOperation,
            isHighPrivilege: query.isHighPrivilege,
            requiresDestinationStation: query.requiresDestinationStation,
            requiresSourceStation: query.requiresSourceStation,
            requiresNotes: query.requiresNotes,
          },
        },
        {
          OR: query.search
            ? [
                {
                  operationType: {
                    name: { contains: query.search, mode: 'insensitive' },
                  },
                },
                {
                  operationType: {
                    code: { contains: query.search, mode: 'insensitive' },
                  },
                },
              ]
            : undefined,
        },
      ],
    };

    const totalCount = await this.prisma.staffStationOperation.count({
      where: dbQuery,
    });

    const data = await this.prisma.staffStationOperation.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.sortService.buildSortQuery(query?.orderBy),
      ...this.representationService.buildCustomRepresentationQuery(
        query?.v ?? this.defaultRep,
      ),
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

  async findOne(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prisma.staffStationOperation.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(
        query?.v ?? this.defaultRep,
      ),
    });
    if (!data)
      throw new NotFoundException('Staff station operation grant not found');
    return data;
  }

  async grant(
    dto: CreateStaffOperationScopeDto,
    grantedById: string,
    query: CustomRepresentationQueryDto,
  ) {
    const { success: canManageOperations } =
      await this.authService.api.userHasPermission({
        body: {
          userId: dto.userId,
          permission: { documentOperation: ['manage'] },
        },
      });
    if (!canManageOperations)
      throw new BadRequestException(
        'User does not have the required staff permissions to be granted station operations',
      );

    return Promise.all(
      dto.operationTypeIds.map((operationTypeId) =>
        // Upsert: re-activate if previously voided
        this.prisma.staffStationOperation.upsert({
          where: {
            userId_stationId_operationTypeId: {
              userId: dto.userId,
              stationId: dto.stationId,
              operationTypeId,
            },
          },
          update: {
            voided: false,
            voidedAt: null,
            voidedById: null,
            grantedById,
          },
          create: {
            userId: dto.userId,
            stationId: dto.stationId,
            operationTypeId,
            grantedById,
          },
          ...this.representationService.buildCustomRepresentationQuery(
            query?.v ?? this.defaultRep,
          ),
        }),
      ),
    );
  }

  async revoke(id: string, revokedById: string, query: DeleteQueryDto) {
    const existing = await this.prisma.staffStationOperation.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Staff station operation grant not found');

    if (query?.purge) {
      return this.prisma.staffStationOperation.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }

    return this.prisma.staffStationOperation.update({
      where: { id },
      data: {
        voided: true,
        voidedAt: new Date(),
        voidedById: revokedById,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async restore(id: string, query: CustomRepresentationQueryDto) {
    const existing = await this.prisma.staffStationOperation.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException('Staff station operation grant not found');

    return this.prisma.staffStationOperation.update({
      where: { id },
      data: {
        voided: false,
        voidedAt: null,
        voidedById: null,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
