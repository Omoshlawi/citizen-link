import { Injectable } from '@nestjs/common';
import { pick } from 'lodash';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  FunctionFirstArgument,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { QueryAddressHierarchyDto } from './address-hierarchy.dto';
import { AddressHierarchy } from '../../generated/prisma/browser';

@Injectable()
export class AddressHierarchyService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sortService: SortService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  async getAll(query: QueryAddressHierarchyDto, originalUrl: string) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.addressHierarchy.findMany
    > = {
      where: {
        AND: [
          {
            voided: query?.includeVoided ? undefined : false,
            country: query?.country,
            level: query?.level,
            code: query?.code,
            name: query?.name,
            nameLocal: query?.nameLocal,
            parentId: query?.parentId,
            parent: {
              code: query?.parentCode,
              country: query?.parentCountry,
              level: query?.parentLevel,
              name: query?.parentName,
              nameLocal: query?.parentNameLocal,
            },
          },
          {
            OR: query.search
              ? [
                  {
                    name: {
                      contains: query.search, //mode: 'insensitive'
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
      this.prismaService.addressHierarchy.findMany(dbQuery),
      this.prismaService.addressHierarchy.count(pick(dbQuery, 'where')),
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

  async delete(id: string, query: DeleteQueryDto) {
    let data: AddressHierarchy;
    if (query?.purge) {
      data = await this.prismaService.addressHierarchy.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.addressHierarchy.update({
        where: { id },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  restore(id: string, query: CustomRepresentationQueryDto) {
    return this.prismaService.addressHierarchy.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
