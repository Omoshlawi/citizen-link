import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { pick } from 'lodash';
import { PaginationService } from '../common/query-builder/pagination.service';
import { FunctionFirstArgument } from '../common/query-builder/query-builder.types';
import { CustomRepresentationQueryDto } from '../common/query-builder/query-builder.utils';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { SortService } from '../common/query-builder/sort.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryDocumentImageDto } from './document-images.dto';

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
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.documentImage.findMany
    > = {
      where: {
        documentId,
        document: { caseId },
        imageType: query?.imageType,
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.documentImage.findMany(dbQuery),
      this.prismaService.documentImage.count(pick(dbQuery, 'where')),
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
