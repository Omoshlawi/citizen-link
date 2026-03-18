import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  PaginationService,
  SortService,
  CustomRepresentationService,
} from '../common/query-builder';
import {
  CreateAddressLocaleDto,
  QueryAddressLocaleDto,
  UpdateAddressLocaleDto,
} from './address-locales.dto';
import { AddressLocale, Prisma } from '../../generated/prisma/client';

@Injectable()
export class AddressLocalesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  create(dto: CreateAddressLocaleDto, query: CustomRepresentationQueryDto) {
    return this.prismaService.addressLocale.create({
      data: {
        ...dto,
        formatSpec: dto.formatSpec as Record<string, any>,
        examples: dto.examples as Record<string, any>,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async findAll(query: QueryAddressLocaleDto, originalUrl: string) {
    const dbQuery: Prisma.AddressLocaleWhereInput = {
      AND: [
        {
          voided: query?.includeVoided ? undefined : false,
          country: query?.country?.toUpperCase(),
          code: query?.code,
          tags: query?.tag ? { has: query.tag } : undefined,
        },
        {
          OR: query.search
            ? [
                { code: { contains: query.search, mode: 'insensitive' } },
                {
                  regionName: { contains: query.search, mode: 'insensitive' },
                },
                {
                  description: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ]
            : undefined,
        },
      ],
    };

    const totalCount = await this.prismaService.addressLocale.count({
      where: dbQuery,
    });
    const data = await this.prismaService.addressLocale.findMany({
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
    const data = await this.prismaService.addressLocale.findUnique({
      where: { id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Address locale not found');
    return data;
  }

  update(
    id: string,
    dto: UpdateAddressLocaleDto,
    query: CustomRepresentationQueryDto,
  ) {
    return this.prismaService.addressLocale.update({
      where: { id },
      data: {
        ...dto,
        formatSpec: dto.formatSpec as Record<string, any>,
        examples: dto.examples as Record<string, any>,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }

  async remove(id: string, query: DeleteQueryDto) {
    let data: AddressLocale;
    if (query?.purge) {
      data = await this.prismaService.addressLocale.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.addressLocale.update({
        where: { id },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  restore(id: string, query: CustomRepresentationQueryDto) {
    return this.prismaService.addressLocale.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
