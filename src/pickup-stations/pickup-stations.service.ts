/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException } from '@nestjs/common';
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
  CreatePickupStationDto,
  QueryPickupStationDto,
  UpdatePickupStationDto,
} from './pickup-station.dto';
import { UserSession } from '../auth/auth.types';
import { isSuperUser } from '../app.utils';
import { pick } from 'lodash';
import { PickupStation } from '../../generated/prisma/client';

@Injectable()
export class PickupStationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sortService: SortService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  async getAll(
    query: QueryPickupStationDto,
    originalUrl: string,
    user?: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: FunctionFirstArgument<
      typeof this.prismaService.pickupStation.findMany
    > = {
      where: {
        AND: [
          {
            voided: isAdmin && query?.includeVoided ? undefined : false,
            level1: query?.level1,
            level2: query?.level2,
            level3: query?.level3,
            level4: query?.level4,
            level5: query?.level5,
            country: query?.country,
            addressLocaleCode: query?.addressLocaleCode,
            postalCode: query?.postalCode,
            createdAt: {
              gte: query?.createdAtFrom,
              lte: query?.createdAtTo,
            },
            code: query.code,
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
                  {
                    code: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    formatted: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                ]
              : undefined,
          },
          {
            OR: query.location
              ? [
                  {
                    name: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    id: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    address1: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    address2: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    country: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    formatted: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    landmark: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    level1: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    level2: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    level3: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    level4: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    level5: {
                      contains: query.location,
                      mode: 'insensitive',
                    },
                  },
                  {
                    postalCode: {
                      contains: query.location,
                      mode: 'insensitive',
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
      this.prismaService.pickupStation.findMany(dbQuery),
      this.prismaService.pickupStation.count(pick(dbQuery, 'where')),
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
    user?: UserSession['user'],
  ) {
    const data = await this.prismaService.pickupStation.findUnique({
      where: {
        id,
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!data) throw new NotFoundException('Pickup station not found');
    return data;
  }

  async create(
    createDto: CreatePickupStationDto,
    userId: string,
    query: CustomRepresentationQueryDto,
  ) {
    const data = await this.prismaService.pickupStation.create({
      data: createDto,
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });

    return data;
  }

  async update(
    id: string,
    updateDto: UpdatePickupStationDto,
    query: CustomRepresentationQueryDto,
    userId: string,
  ) {
    const data = await this.prismaService.pickupStation.update({
      where: { id },
      data: updateDto,
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return data;
  }

  async delete(id: string, query: DeleteQueryDto, userId: string) {
    let data: PickupStation;
    if (query?.purge) {
      data = await this.prismaService.pickupStation.delete({
        where: { id },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } else {
      data = await this.prismaService.pickupStation.update({
        where: { id },
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
    return this.prismaService.pickupStation.update({
      where: { id },
      data: { voided: false },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
  }
}
