import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  PaginationService,
  SortService,
} from '../../common/query-builder';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateStaffStationOperationDto,
  MyStationDto,
  QueryStaffStationOperationsDto,
} from '../document-custody.dto';

@Injectable()
export class StaffStationOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findMyStations(userId: string) {
    const stations = await this.prisma.pickupStation.findMany({
      where: {
        staffStationOperations: { some: { userId, voided: false } },
      },
      select: {
        id: true,
        name: true,
        code: true,
        level1: true,
        level2: true,
        staffStationOperations: {
          where: { userId, voided: false },
          select: {
            operationType: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    const results: MyStationDto[] = stations.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      level1: s.level1,
      level2: s.level2 ?? null,
      operations: s.staffStationOperations
        .map((g) => g.operationType)
        .filter((op): op is MyStationDto['operations'][number] => op !== null),
    }));

    return { results, totalCount: results.length };
  }

  async findAll(query: QueryStaffStationOperationsDto, originalUrl: string) {
    const dbQuery: Prisma.StaffStationOperationWhereInput = {
      voided: query.includeVoided ? undefined : false,
      userId: query.userId,
      stationId: query.stationId,
      operationTypeId: query.operationTypeId,
    };

    const totalCount = await this.prisma.staffStationOperation.count({
      where: dbQuery,
    });

    const data = await this.prisma.staffStationOperation.findMany({
      where: dbQuery,
      include: {
        user: { select: { id: true, name: true } },
        station: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, code: true, name: true } },
        grantedBy: { select: { id: true, name: true } },
      },
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
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

  async findOne(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prisma.staffStationOperation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        station: { select: { id: true, name: true, code: true } },
        operationType: { select: { id: true, code: true, name: true } },
        grantedBy: { select: { id: true, name: true } },
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data)
      throw new NotFoundException('Staff station operation grant not found');
    return data;
  }

  async grant(
    dto: CreateStaffStationOperationDto,
    grantedById: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query: CustomRepresentationQueryDto,
  ) {
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
          include: {
            user: { select: { id: true, name: true } },
            station: { select: { id: true, name: true, code: true } },
            operationType: { select: { id: true, code: true, name: true } },
            grantedBy: { select: { id: true, name: true } },
          },
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
