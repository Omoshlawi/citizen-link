import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransitionReason } from '../../generated/prisma/client';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStatusTransitionReasonsDto } from './status-transitions.dto';

@Injectable()
export class TransitionReasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findAll(query: QueryStatusTransitionReasonsDto, originalUrl: string) {
    const dbQuery: Prisma.TransitionReasonWhereInput = {
      AND: [
        {
          voided: query?.includeVoided ? undefined : false,
          entityType:
            query?.entityType && query.includeGlobal
              ? { in: [query?.entityType, '*'] }
              : query?.entityType,
          fromStatus:
            query?.fromStatus && query.includeGlobal
              ? { in: [query?.fromStatus, '*'] }
              : query?.fromStatus,
          toStatus:
            query?.toStatus && query.includeGlobal
              ? { in: [query?.toStatus, '*'] }
              : query?.toStatus,
          auto: query?.auto,
          label: query?.label,
          code: query?.code,
        },
        {
          OR: query.search
            ? [
                {
                  label: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  code: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ]
            : undefined,
        },
      ],
    };
    const totalCount = await this.prisma.transitionReason.count({
      where: dbQuery,
    });
    const data = await this.prisma.transitionReason.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
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
    const data = await this.prisma.transitionReason.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Transition reason not found');
    return data;
  }

  async remove(id: string, query: DeleteQueryDto) {
    let data: TransitionReason;
    if (query?.purge) {
      data = await this.prisma.transitionReason.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prisma.transitionReason.update({
        where: { id },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  async restore(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prisma.transitionReason.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }
}
