import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SetSettingDto,
  QuerySettingObjectDto,
  QuerySettingsDto,
  SetSettingObjectDto,
  DeleteSettingDto,
} from './settings.dto';
import { Prisma } from 'generated/prisma/client';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../query-builder';
import { UserSession } from '../../auth/auth.types';
import { BetterAuthWithPlugins } from '../../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { SettingsUtils } from './settings.utils';
import { SystemSettingService } from './settings.system.service';
import { UserSettingService } from './settings.user.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly systemSettingService: SystemSettingService,
    private readonly userSettingService: UserSettingService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
  ) {}

  async queryAll(
    query: QuerySettingsDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { setting: ['view-any'] } },
    });
    const dbQuery: Prisma.SettingWhereInput = {
      AND: [
        {
          // voided: query?.includeVoided ? undefined : false,
          key:
            query.key ??
            (query.keyPrefix
              ? { startsWith: `${query.keyPrefix}.` }
              : undefined),
          isPublic: isAdmin ? undefined : true,
        },
        {
          userId: {
            in: isAdmin
              ? [
                  query?.userId ?? user?.id,
                  ...(query.includeSystemSettings ? ['*'] : []),
                ]
              : [user.id, ...(query.includeSystemSettings ? ['*'] : [])],
          },
        },
        {
          OR: query.search
            ? [
                {
                  key: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ]
            : undefined,
        },
      ],
    };
    const totalCount = await this.prisma.setting.count({
      where: dbQuery,
    });

    const data = await this.prisma.setting.findMany({
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

  async queryObject(query: QuerySettingObjectDto, user: UserSession['user']) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { setting: ['view-any'] } },
    });
    const dbQuery: Prisma.SettingWhereInput = {
      AND: [
        {
          key: { startsWith: `${query.keyPrefix}.` },
          userId: isAdmin ? (query.userId ?? user.id) : user.id,
          // voided: query?.includeVoided ? undefined : false,
        },
      ],
    };
    const settings = await this.prisma.setting.findMany({
      where: dbQuery,
    });
    return SettingsUtils.nestSettings(settings, query.keyPrefix) ?? {};
  }

  async setSetting(
    data: SetSettingDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { setting: ['manage-system'] } },
    });
    if (!isAdmin && data.isSystemSetting)
      throw new ForbiddenException(
        'You are not authorized to alter system settings',
      );
    const createdSetting = await this.prisma.setting.upsert({
      where: {
        key_userId: {
          key: data.key,
          userId: data.isSystemSetting ? '*' : user.id,
        },
      },
      create: {
        key: data.key,
        value: data.value,
        userId: data.isSystemSetting ? undefined : user.id,
        description: data.description,
        isPublic: data.isPublic,
        updatedBy: user.id,
      },
      update: {
        value: data.value,
        description: data.description,
        updatedBy: user.id,
        ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return createdSetting;
  }

  async setObjectSetting(data: SetSettingObjectDto, user: UserSession['user']) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { setting: ['manage-system'] } },
    });
    if (!isAdmin && data.isSystemSetting)
      throw new ForbiddenException(
        'You are not authorized to alter system settings',
      );
    // Flatten the parsed (typed) object to dot-notation rows
    const flat = SettingsUtils.flattenObject(
      data.object,
      data.prefix,
    ) as Record<string, string>;

    const settings = await this.prisma.$transaction(
      Object.entries(flat).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key_userId: { key, userId: user.id } },
          create: { key, userId: user.id, value: value },
          update: { value: value },
        }),
      ),
    );

    return SettingsUtils.nestSettings(settings, data.prefix) ?? {};
  }

  async deleteSetting(
    { keyOrPrefix, isSystemSetting }: DeleteSettingDto,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { setting: ['manage-system'] } },
    });
    if (!isAdmin && isSystemSetting)
      throw new ForbiddenException(
        'You are not authorized to alter system settings',
      );
    if (isSystemSetting) {
      await this.systemSettingService.delete(keyOrPrefix);
    } else {
      await this.userSettingService.delete(user.id, keyOrPrefix);
    }
    return { message: 'Setting deleted successfully' };
  }
}
