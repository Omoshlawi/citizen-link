import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaginationService } from '../common/query-builder/pagination.service';
import { CustomRepresentationQueryDto } from '../common/query-builder/query-builder.utils';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { SortService } from '../common/query-builder/sort.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryDocumentImageDto } from './document-images.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class DocumentImagesService {
  private readonly logger = new Logger(DocumentImagesService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  async findAll(
    query: QueryDocumentImageDto,
    originalUrl: string,
    caseId: string,
    documentId: string,
  ) {
    const dbQuery: Prisma.DocumentImageWhereInput = {
      documentId,
      document: { caseId },
      imageType: query?.imageType,
    };
    const totalCount = await this.prismaService.documentImage.count({
      where: dbQuery,
    });

    const data = await this.prismaService.documentImage.findMany({
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

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    caseId: string,
    documentId: string,
  ) {
    const data = await this.prismaService.documentImage.findUnique({
      where: { id, documentId, document: { caseId } },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Image not found');
    return data;
  }
}
