/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  DeleteQueryDto,
  PaginationService,
  SortService,
} from '../common/query-builder';
import {
  CreatePickupStationDto,
  GetUserAssignedStationsDto,
  QueryPickupStationDto,
  UpdatePickupStationDto,
} from './pickup-station.dto';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { PickupStation, Prisma } from '../../generated/prisma/client';
import { RegionService } from '../region/region.service';

@Injectable()
export class PickupStationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly sortService: SortService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly regionService: RegionService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  private getQuery = (
    query: QueryPickupStationDto,
    isAdmin?: boolean,
    ...additionalQueries: Array<Prisma.PickupStationWhereInput>
  ) => {
    const dbQuery: Prisma.PickupStationWhereInput = {
      AND: [
        {
          voided: isAdmin && query?.includeVoided ? undefined : false,
          level1: query?.level1,
          level2: query?.level2,
          level3: query?.level3,
          level4: query?.level4,
          level5: query?.level5,
          country: this.regionService.getCountryCode(),
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
        ...additionalQueries,
      ],
    };
    return dbQuery;
  };

  async getAll(
    query: QueryPickupStationDto,
    originalUrl: string,
    user?: UserSession['user'],
  ) {
    const { success: isAdmin } = user
      ? await this.authService.api.userHasPermission({
          body: {
            userId: user.id,
            permission: { staffStationOperation: ['view'] },
          },
        })
      : { success: false };
    const dbQuery: Prisma.PickupStationWhereInput = this.getQuery(
      query,
      isAdmin,
    );
    const totalCount = await this.prismaService.pickupStation.count({
      where: dbQuery,
    });
    const data = await this.prismaService.pickupStation.findMany({
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
    const { latitude, longitude, ...props } = createDto;
    const data = await this.prismaService.pickupStation.create({
      data: { ...props, coordinates: { lat: latitude, lng: longitude } },
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
    const { latitude, longitude, ...props } = updateDto;

    const data = await this.prismaService.pickupStation.update({
      where: { id },
      data: {
        ...props,
        coordinates:
          latitude && longitude ? { lat: latitude, lng: longitude } : undefined,
      },
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

  async getAssignedStations(
    query: GetUserAssignedStationsDto,
    user: UserSession['user'],
    originalUrl: string,
  ) {
    let userId = user.id;

    // Check if the target user (userId) has global 'manage' permission for 'stationOperationType'
    const { success: hasGlobalManage } =
      await this.authService.api.userHasPermission({
        body: {
          userId,
          permission: { stationOperationType: ['manage'] },
        },
      });

    if (hasGlobalManage && query.userId) {
      if (query.userId) {
        const user = await this.prismaService.user.findUnique({
          where: { id: query.userId },
        });
        if (!user) throw new NotFoundException('User not found');
        userId = user.id;
      }
    }

    if (hasGlobalManage && !query.userId) {
      const dbQuery = this.getQuery(query, hasGlobalManage);
      const totalCount = await this.prismaService.pickupStation.count({
        where: dbQuery,
      });
      const data = await this.prismaService.pickupStation.findMany({
        where: dbQuery,
        ...this.paginationService.buildSafePaginationQuery(query, totalCount),
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
        ...this.sortService.buildSortQuery(query?.orderBy),
      });
      // Return all stations
      return {
        results: data,
        ...this.paginationService.buildPaginationControls(
          totalCount,
          originalUrl,
          query,
        ),
      };
    }

    // Otherwise, find stations where they have active grants
    const staffGrants = await this.prismaService.staffStationOperation.findMany(
      {
        where: { userId, voided: false },
        select: { stationId: true },
      },
    );

    const stationIds = [...new Set(staffGrants.map((sg) => sg.stationId))];
    const dbQuery = this.getQuery(query, hasGlobalManage, {
      id: { in: stationIds },
    });
    const totalCount = await this.prismaService.pickupStation.count({
      where: dbQuery,
    });
    const data = await this.prismaService.pickupStation.findMany({
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
}
