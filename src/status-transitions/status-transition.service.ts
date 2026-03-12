import { Injectable, NotFoundException } from '@nestjs/common';
import { pick } from 'lodash';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStatusTransitionsDto } from './status-transitions.transitions.dto';

@Injectable()
export class StatusTransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findAll(query: QueryStatusTransitionsDto, originalUrl: string) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prisma.statusTransition.findMany
    > = {
      where: {
        entityType: query.entityType,
        entityId: query.entityId,
        fromStatus: query.fromStatus,
        toStatus: query.toStatus,
        reasonId: query.reasonId,
        changedById: query.changedById,
        ...(query.search
          ? {
              OR: [
                {
                  comment: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  entityType: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  fromStatus: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  toStatus: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : undefined),
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };

    const [data, totalCount] = await Promise.all([
      this.prisma.statusTransition.findMany(dbQuery),
      this.prisma.statusTransition.count(pick(dbQuery, 'where')),
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

  async findOne(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prisma.statusTransition.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Status transition not found');
    return data;
  }
}
