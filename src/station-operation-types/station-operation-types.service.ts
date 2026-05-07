import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStationOperationTypeDto,
  QueryStationOperationTypesDto,
  UpdateStationOperationTypeDto,
} from './station-operation-types.dto';

@Injectable()
export class StationOperationTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findAll(
    stationId: string,
    query: QueryStationOperationTypesDto,
    originalUrl: string,
  ) {
    const dbQuery: Prisma.StationOperationTypeWhereInput = {
      AND: [
        {
          stationId,
          voided: query.includeVoided ? undefined : false,
          isEnabled: query.isEnabled,
          operationType: {
            isFinalOperation: query.isFinalOperation,
            isHighPrivilege: query.isHighPrivilege,
            requiresCounterpartStation: query.requiresCounterpartStation,
            requiresNotes: query.requiresNotes,
            requiresItemAddresses: query.requiresItemAddresses,
            requiresTargetArea: query.requiresTargetArea,
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

    const totalCount = await this.prisma.stationOperationType.count({
      where: dbQuery,
    });

    const data = await this.prisma.stationOperationType.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.sortService.buildSortQuery(query?.orderBy),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
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

  async create(
    stationId: string,
    dto: CreateStationOperationTypeDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prisma.stationOperationType.create({
      data: { stationId, ...dto },
      include: { operationType: true },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async update(
    id: string,
    dto: UpdateStationOperationTypeDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prisma.stationOperationType.update({
      where: { id },
      data: dto,
      include: { operationType: true },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async remove(id: string, query: DeleteQueryDto) {
    if (query?.purge) {
      return this.prisma.stationOperationType.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return this.prisma.stationOperationType.update({
      where: { id },
      data: { voided: true },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async restore(id: string, query: CustomRepresentationQueryDto) {
    return this.prisma.stationOperationType.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
