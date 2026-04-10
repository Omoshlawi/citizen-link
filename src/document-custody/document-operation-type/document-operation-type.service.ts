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
  CreateDocumentOperationTypeDto,
  QueryDocumentOperationTypesDto,
  UpdateDocumentOperationTypeDto,
} from '../document-custody.dto';

@Injectable()
export class DocumentOperationTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findAll(query: QueryDocumentOperationTypesDto, originalUrl: string) {
    const dbQuery: Prisma.DocumentOperationTypeWhereInput = {
      voided: query.includeVoided ? undefined : false,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const totalCount = await this.prisma.documentOperationType.count({
      where: dbQuery,
    });

    const data = await this.prisma.documentOperationType.findMany({
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
    const data = await this.prisma.documentOperationType.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Document operation type not found');
    return data;
  }

  async create(
    dto: CreateDocumentOperationTypeDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prisma.documentOperationType.create({
      data: dto,
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async update(
    id: string,
    dto: UpdateDocumentOperationTypeDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prisma.documentOperationType.update({
      where: { id },
      data: dto,
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async remove(id: string, query: DeleteQueryDto) {
    if (query?.purge) {
      return this.prisma.documentOperationType.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return this.prisma.documentOperationType.update({
      where: { id },
      data: { voided: true },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async restore(id: string, query: CustomRepresentationQueryDto) {
    return this.prisma.documentOperationType.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
