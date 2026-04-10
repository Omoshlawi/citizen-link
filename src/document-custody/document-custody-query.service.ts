import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PaginationService, SortService } from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { QueryDocumentOperationsDto } from './document-custody.dto';

@Injectable()
export class DocumentCustodyQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly sortService: SortService,
  ) {}

  async getHistory(
    foundCaseId: string,
    query: QueryDocumentOperationsDto,
    originalUrl: string,
  ) {
    const foundCase = await this.prisma.foundDocumentCase.findUnique({
      where: { id: foundCaseId },
    });
    if (!foundCase)
      throw new NotFoundException('Found document case not found');

    const dbQuery: Prisma.DocumentOperationWhereInput = {
      foundCaseId,
      operationTypeId: query.operationTypeId,
      stationId: query.stationId,
      performedById: query.performedById,
    };

    const totalCount = await this.prisma.documentOperation.count({
      where: dbQuery,
    });

    const data = await this.prisma.documentOperation.findMany({
      where: dbQuery,
      include: {
        operationType: true,
        station: { select: { id: true, name: true, code: true } },
        fromStation: { select: { id: true, name: true, code: true } },
        toStation: { select: { id: true, name: true, code: true } },
        performedBy: { select: { id: true, name: true } },
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
}
