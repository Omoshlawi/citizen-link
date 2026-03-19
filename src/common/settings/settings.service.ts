// src/settings/settings.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { z } from 'zod';
import {
  SetSettingDto,
  QuerySettingObjectDto,
  QuerySettingsDto,
  SetSettingObjectDto,
} from './settings.dto';
import { Prisma } from 'generated/prisma/client';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../query-builder';
import { UserSession } from '../../auth/auth.types';
import { isSuperUser } from 'src/app.utils';
import { SettingsUtils } from './settings.utils';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly systemCache = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
  ) {}

  /**
   * Get one setting parsed through a Zod schema.
   * The schema receives the raw stored string and coerces it.
   *
   * @example
   * import { SettingBoolean, SettingNumber, SettingString } from './settings.schemas';
   *
   * const theme   = await settings.get(userId, 'theme', SettingString, 'light');
   * const cols    = await settings.get(userId, 'dashboard.cols', SettingNumber, 2);
   * const enabled = await settings.get(userId, 'notifications.email', SettingBoolean, true);
   */
  async get<S extends z.ZodTypeAny>(
    userId: string,
    key: string,
    schema: S,
    defaultValue: z.infer<S>,
  ): Promise<z.infer<S>> {
    const row = await this.prisma.setting.findUnique({
      where: { key_userId: { key, userId } },
    });
    if (!row) return defaultValue;
    return this.parse(schema, row.value, key, defaultValue);
  }

  /**
   * Get all settings under a prefix, parsed through a Zod object schema.
   * Missing keys fall back to the schema's defaults.
   *
   * @example
   * import { NotificationSettingsSchema } from './settings.schemas';
   *
   * const notif = await settings.getObject(userId, 'notifications', NotificationSettingsSchema);
   * notif.email        // boolean
   * notif.quiet_start  // number | null
   * notif.timezone     // string
   * { email: true, sms: false, quiet_start: 22, quiet_end: 7 }

   */
  async getObject<S extends z.ZodObject<z.ZodRawShape>>(
    userId: string,
    prefix: string,
    schema: S,
  ): Promise<z.infer<S>> {
    const rows = await this.prisma.setting.findMany({
      where: {
        userId,
        key: { startsWith: `${prefix}.` },
      },
    });
    const obj = SettingsUtils.nestSettings(rows, prefix);

    // Parse through the schema — missing keys hit schema defaults, extras are stripped
    const result = schema.safeParse(obj);
    if (!result.success) {
      this.logger.warn(
        `Settings parse error for prefix "${prefix}": ${z.prettifyError(result.error)}`,
      );
      // Fall back to schema defaults on parse failure
      return schema.parse({});
    }
    return result.data;
  }

  /**
   * Get all settings for a user as a raw flat map (no parsing).
   * Useful for serialising to the frontend where the client parses.
   */
  async getAll(userId: string): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({ where: { userId } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async queryAll(
    query: QuerySettingsDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: Prisma.SettingWhereInput = {
      AND: [
        {
          voided: query?.includeVoided ? undefined : false,
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
    const isAdmin = isSuperUser(user);
    const dbQuery: Prisma.SettingWhereInput = {
      AND: [
        {
          key: { startsWith: `${query.keyPrefix}.` },
          userId: isAdmin ? (query.userId ?? user.id) : user.id,
        },
      ],
    };
    const settings = await this.prisma.setting.findMany({
      where: dbQuery,
    });
    return SettingsUtils.nestSettings(settings, query.keyPrefix);
  }

  async setSetting(
    data: SetSettingDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const isAdmin = isSuperUser(user);
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
      },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    return createdSetting;
  }

  async setObjectSetting(data: SetSettingObjectDto, user: UserSession['user']) {
    const isAdmin = isSuperUser(user);
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

    return SettingsUtils.nestSettings(settings, data.prefix);
  }

  /**
   * Set one atomic value. Validates through schema before writing.
   *
   * @example
   * await settings.set(userId, 'theme', 'dark', SettingString);
   * await settings.set(userId, 'notifications.email', 'false', SettingBoolean);
   * await settings.set(userId, 'dashboard.cols', '3', SettingNumber);
   */
  async set<S extends z.ZodTypeAny>(
    userId: string,
    key: string,
    value: string,
    schema: S,
  ): Promise<z.infer<S>> {
    // Validate before writing — throws BadRequestException on failure
    const parsed = this.parse(schema, value, key);
    const stored = SettingsUtils.serialize(parsed);

    await this.prisma.setting.upsert({
      where: { key_userId: { key, userId } },
      create: { key, userId, value: stored },
      update: { value: stored },
    });

    return parsed;
  }

  /**
   * Flatten a validated object and write each leaf atomically.
   *
   * @example
   * import { NotificationSettingsSchema } from './settings.schemas';
   *
   * await settings.setObject(userId, 'notifications', {
   *   email: 'true',
   *   sms: 'false',
   *   quiet_start: '22',
   *   timezone: 'Africa/Nairobi',
   * }, NotificationSettingsSchema);
   */
  async setObject<S extends z.ZodObject<z.ZodRawShape>>(
    userId: string,
    prefix: string,
    raw: Record<string, any>,
    schema: S,
  ): Promise<z.infer<S>> {
    // Parse the whole object at once — schema handles coercion + defaults
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new BadRequestException(z.prettifyError(result.error));
    }

    // Flatten the parsed (typed) object to dot-notation rows
    const flat = SettingsUtils.flattenObject(result.data, prefix) as Record<
      string,
      string
    >;

    await this.prisma.$transaction(
      Object.entries(flat).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key_userId: { key, userId } },
          create: { key, userId, value: value },
          update: { value: value },
        }),
      ),
    );

    return result.data;
  }

  /**
   * Delete a single key or all keys under a prefix.
   *
   * @example
   * await settings.delete(userId, 'theme');        // one key
   * await settings.delete(userId, 'dashboard');    // all dashboard.* keys
   */
  async delete(userId: string, keyOrPrefix: string): Promise<void> {
    await this.prisma.setting.deleteMany({
      where: {
        userId,
        OR: [{ key: keyOrPrefix }, { key: { startsWith: `${keyOrPrefix}.` } }],
      },
    });
  }

  private parse<S extends z.ZodTypeAny>(
    schema: S,
    raw: string,
    key: string,
    defaultValue?: z.infer<S>,
  ): z.infer<S> {
    const result = schema.safeParse(raw);
    if (result.success) return result.data;

    const message = z.prettifyError(result.error);
    this.logger.warn(`Failed to parse setting "${key}": ${message}`);

    if (defaultValue !== undefined) return defaultValue;
    throw new BadRequestException(
      `Invalid value for setting "${key}": ${message}`,
    );
  }
}
