import { Injectable, NotFoundException } from '@nestjs/common';
import { pick } from 'lodash';
import { FunctionFirstArgument } from 'src/query-builder/query-builder.types';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationService } from '../query-builder/pagination.service';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
} from '../query-builder/query-builder.utils';
import { CustomRepresentationService } from '../query-builder/representation.service';
import { SortService } from '../query-builder/sort.service';
import { QueryDocumentImageDto } from './document-images.dto';

@Injectable()
export class DocumentImagesService {
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
      typeof this.prismaService.image.findMany
    > = {
      where: {
        documentId,
        document: { caseId },
        imageType: query?.imageType,
        voided: query?.includeVoided ? undefined : false,
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.image.findMany(dbQuery),
      this.prismaService.image.count(pick(dbQuery, 'where')),
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
    const data = await this.prismaService.image.findUnique({
      where: { id, documentId, document: { caseId } },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Image not found');
    return data;
  }

  remove(
    id: string,
    query: DeleteQueryDto,
    caseId: string,
    documentId: string,
  ) {
    if (query?.purge) {
      return this.prismaService.image.delete({
        where: { id, documentId, document: { caseId } },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      return this.prismaService.image.update({
        where: { id, documentId, document: { caseId } },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
  }

  restore(
    id: string,
    query: CustomRepresentationQueryDto,
    caseId: string,
    documentId: string,
  ) {
    return this.prismaService.image.update({
      where: { id, documentId, document: { caseId } },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
