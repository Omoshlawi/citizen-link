import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateDocumentTypeDto,
  QueryDocumentTypeDto,
  UpdateDocumentTypeDto,
} from './document-type.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationService } from '../common/query-builder/pagination.service';
import { CustomRepresentationService } from '../common/query-builder/representation.service';
import { SortService } from '../common/query-builder/sort.service';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
} from '../common/query-builder/query-builder.utils';
import { DocumentType, Prisma } from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { RegionService } from '../region/region.service';

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly regionService: RegionService,
  ) {}
  create(
    createDocumentTypeDto: CreateDocumentTypeDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prismaService.documentType.create({
      data: {
        ...createDocumentTypeDto,
        verificationStrategy: {},
        currency:
          createDocumentTypeDto.currency ?? this.regionService.getCurrency(),
        totalAmount: new Decimal(createDocumentTypeDto.serviceFee).plus(
          createDocumentTypeDto.finderReward,
        ),
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async findAll(query: QueryDocumentTypeDto, originalUrl: string) {
    const dbQuery: Prisma.DocumentTypeWhereInput = {
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
                    mode: 'insensitive',
                  },
                },
              ]
            : undefined,
        },
      ],
    };
    const totalCount = await this.prismaService.documentType.count({
      where: dbQuery,
    });

    const data = await this.prismaService.documentType.findMany({
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
      data: {
        ...updateDocumentTypeDto,
        totalAmount:
          updateDocumentTypeDto.serviceFee != null &&
          updateDocumentTypeDto.finderReward != null
            ? new Decimal(updateDocumentTypeDto.serviceFee).plus(
                updateDocumentTypeDto.finderReward,
              )
            : undefined,
      },
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
