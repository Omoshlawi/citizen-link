import { Injectable, NotFoundException } from '@nestjs/common';
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
import {
  CreateAddressDto,
  QueryAddressDto,
  UpdateAddressDto,
} from './address.dto';
import { Address, AddressType } from '../../generated/prisma/browser';
import dayjs from 'dayjs';

@Injectable()
export class AddressService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sortService: SortService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  async getAll(query: QueryAddressDto, originalUrl: string, userId: string) {
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.address.findMany
    > = {
      where: {
        AND: [
          {
            voided: query?.includeVoided ? undefined : false,
            userId,
            type: query?.type as AddressType,
            level1: query?.level1,
            level2: query?.level2,
            level3: query?.level3,
            level4: query?.level4,
            level5: query?.level5,
            country: query?.country,
            localeId: query?.localeId,
            postalCode: query?.postalCode,
            startDate: {
              gte: query?.startDateFrom,
              lte: query?.startDateTo,
            },
            endDate: {
              gte: query?.endDateFrom,
              lte: query?.endDateTo,
            },
            createdAt: {
              gte: query?.createdAtFrom,
              lte: query?.createdAtTo,
            },
          },
          {
            OR: query.search
              ? [
                  {
                    label: {
                      contains: query.search, //mode: 'insensitive'
                    },
                  },
                  {
                    formatted: {
                      contains: query.search, //mode: 'insensitive'
                    },
                  },
                ]
              : undefined,
          },
          {
            OR: query.location
              ? [
                  {
                    label: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    id: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    address1: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    address2: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    cityVillage: {
                      contains: query.location,
                      // mode: 'insensitive',
                    },
                  },
                  {
                    country: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    formatted: {
                      contains: query.location,
                      // mode: 'insensitive',
                    },
                  },
                  {
                    label: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    landmark: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    level1: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    level2: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    level3: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    level4: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    level5: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    plusCode: {
                      contains: query.location, //mode: 'insensitive'
                    },
                  },
                  {
                    postalCode: {
                      contains: query.location,
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
      this.prismaService.address.findMany(dbQuery),
      this.prismaService.address.count(pick(dbQuery, 'where')),
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

  async getById(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    const data = await this.prismaService.address.findUnique({
      where: {
        id,
        userId,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Address not found');
    return data;
  }

  async create(
    createDto: CreateAddressDto,
    userId: string,
    query: CustomRepresentationQueryDto,
  ) {
    const data = await this.prismaService.address.create({
      data: {
        ...createDto,
        userId,
        startDate: dayjs(createDto.startDate).toDate(),
        endDate: createDto.endDate
          ? dayjs(createDto.endDate).toDate()
          : undefined,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });

    return data;
  }

  async update(
    id: string,
    updateDto: UpdateAddressDto,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    const data = await this.prismaService.address.update({
      where: { id, userId },
      data: updateDto,
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }

  async delete(id: string, query: DeleteQueryDto, userId: string) {
    let data: Address;
    if (query?.purge) {
      data = await this.prismaService.address.delete({
        where: { id, userId },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.address.update({
        where: { id, userId },
        data: { voided: true },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    }
    return data;
  }

  async restore(
    id: string,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    return this.prismaService.address.update({
      where: { id, userId },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
