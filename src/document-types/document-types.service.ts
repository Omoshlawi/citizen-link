import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateDocumentTypeDto,
  QueryDocumentTypeDto,
  UpdateDocumentTypeDto,
} from './document-type.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationService } from '../query-builder/pagination.service';
import { CustomRepresentationService } from '../query-builder/representation.service';
import { SortService } from '../query-builder/sort.service';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
} from '../query-builder/query-builder.utils';
import { FunctionFirstArgument } from '../query-builder/query-builder.types';
import { pick } from 'lodash';
import { DocumentType } from '../../generated/prisma/browser';

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}
  create(
    createDocumentTypeDto: CreateDocumentTypeDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prismaService.documentType.create({
      data: { ...createDocumentTypeDto, verificationStrategy: {} },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async findAll(query: QueryDocumentTypeDto, originalUrl: string) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.documentType.findMany
    > = {
      where: {
        AND: [
          {
            voided: query?.includeVoided ? undefined : false,
            category: query?.category,
          },
          {
            OR: query.search
              ? [
                  {
                    name: {
                      contains: query.search,
                      // mode: 'insensitive',
                    },
                  },
                ]
              : undefined,
          },
        ],
      },
      ...this.paginationService.buildPaginationQuery(query),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    };
    const [data, totalCount] = await Promise.all([
      this.prismaService.documentType.findMany(dbQuery),
      this.prismaService.documentType.count(pick(dbQuery, 'where')),
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
    const data = await this.prismaService.documentType.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Document type not found');
    return data;
  }

  update(
    id: string,
    updateDocumentTypeDto: UpdateDocumentTypeDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prismaService.documentType.update({
      where: { id },
      data: updateDocumentTypeDto,
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async remove(id: string, query: DeleteQueryDto) {
    let data: DocumentType;
    if (query?.purge) {
      data = await this.prismaService.documentType.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.documentType.update({
        where: { id },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  async restore(id: string, query: CustomRepresentationQueryDto) {
    const data = await this.prismaService.documentType.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }
}
