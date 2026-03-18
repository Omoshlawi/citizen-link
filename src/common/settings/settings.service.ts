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

type Primitive = string | number | boolean | null;
type NestedObject = { [k: string]: Primitive | NestedObject | NestedArray };
type NestedArray = (Primitive | NestedObject)[];

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

    // Build a flat object from stored rows, stripping the prefix
    const strip = `${prefix}.`.length;
    const flat: Record<string, string> = {};
    for (const row of rows) {
      flat[row.key.slice(strip)] = row.value;
    }

    // Parse through the schema — missing keys hit schema defaults, extras are stripped
    const result = schema.safeParse(flat);
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
    return this.unflatten(
      settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}),
    );
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

  setObjectSetting(
    data: SetSettingObjectDto,
    user: UserSession['user'],
    query: CustomRepresentationQueryDto,
  ) {
    const isAdmin = isSuperUser(user);
    if (!isAdmin && data.isSystemSetting)
      throw new ForbiddenException(
        'You are not authorized to alter system settings',
      );
    const flat = this.flatten(data.object, data.prefix);
    return { flat, query };
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
    const stored = this.serialize(parsed);

    await this.prisma.setting.upsert({
      where: { key_userId: { key, userId } },
      create: { key, userId, value: stored },
      update: { value: stored },
    });

    return parsed;
  }

  /**
   * Set multiple atomic values in one transaction.
   * Each entry is validated through its own schema.
   *
   * @example
   * await settings.setMany(userId, [
   *   { key: 'theme',                    value: 'dark',          schema: SettingString  },
   *   { key: 'notifications.email',      value: 'true',          schema: SettingBoolean },
   *   { key: 'notifications.quiet_start',value: '22',            schema: SettingInt     },
   *   { key: 'locale',                   value: 'sw-KE',         schema: SettingString  },
   * ]);
   */
  async setMany(
    userId: string,
    entries: { key: string; value: string; schema: z.ZodTypeAny }[],
  ): Promise<void> {
    // Validate all first — fail fast before any writes
    const validated = entries.map(({ key, value, schema }) => ({
      key,
      value: this.serialize(this.parse(schema, value, key)),
    }));

    await this.prisma.$transaction(
      validated.map(({ key, value }) =>
        this.prisma.setting.upsert({
          where: { key_userId: { key, userId } },
          create: { key, userId, value },
          update: { value },
        }),
      ),
    );
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
    raw: Record<string, string>,
    schema: S,
  ): Promise<z.infer<S>> {
    // Parse the whole object at once — schema handles coercion + defaults
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new BadRequestException(z.prettifyError(result.error));
    }

    // Flatten the parsed (typed) object to dot-notation rows
    const flat = this.flatten(result.data, prefix);

    await this.prisma.$transaction(
      Object.entries(flat).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key_userId: { key, userId } },
          create: { key, userId, value: this.serialize(value) },
          update: { value: this.serialize(value) },
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

  // ══════════════════════════════════════════════════════════════════════════
  // SYSTEM SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * @example
   * const maxMb   = await settings.getSystem('app.max_upload_mb', SettingNumber, 10);
   * const enabled = await settings.getSystem('features.new_dashboard', SettingBoolean, false);
   * const from    = await settings.getSystem('email.from', SettingString, 'noreply@app.com');
   */
  async getSystem<S extends z.ZodTypeAny>(
    key: string,
    schema: S,
    defaultValue: z.infer<S>,
  ): Promise<z.infer<S>> {
    if (this.systemCache.has(key)) {
      return this.parse(schema, this.systemCache.get(key)!, key, defaultValue);
    }
    const row = await this.prisma.setting.findUnique({
      where: { key_userId: { key, userId: '*' } },
    });
    if (!row) return defaultValue;
    this.systemCache.set(key, row.value);
    return this.parse(schema, row.value, key, defaultValue);
  }

  async getPublicSystem(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({
      where: { userId: '*', isPublic: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setSystem<S extends z.ZodTypeAny>(
    key: string,
    value: string,
    schema: S,
    opts: { description?: string; isPublic?: boolean; updatedBy?: string } = {},
  ): Promise<z.infer<S>> {
    const parsed = this.parse(schema, value, key);
    const stored = this.serialize(parsed);
    this.systemCache.set(key, stored);

    await this.prisma.setting.upsert({
      where: { key_userId: { key, userId: '*' } },
      create: { key, userId: '*', value: stored, ...opts },
      update: { value: stored, ...opts },
    });

    return parsed;
  }

  async deleteSystem(key: string): Promise<void> {
    this.systemCache.delete(key);
    await this.prisma.setting.deleteMany({
      where: { key, userId: '*' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

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

  private serialize(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (value instanceof Date) return value.toISOString();
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }

  private flatten(
    obj: Record<string, unknown>,
    prefix: string,
    result: Record<string, unknown> = {},
  ): Record<string, unknown> {
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = `${prefix}.${k}`;
      if (
        v !== null &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        !(v instanceof Date)
      ) {
        this.flatten(v as Record<string, unknown>, fullKey, result);
      } else {
        result[fullKey] = v;
      }
    }
    return result;
  }

  /**
   * Reconstruct a nested object from a flat map of dot-notation keys.
   * Array indices (numeric segments) are reconstructed as arrays.
   *
   * @example
   * unflatten({
   *   'notifications.email':       'true',
   *   'notifications.quiet_start': '22',
   *   'notifications.timezone':    'Africa/Nairobi',
   *   'dashboard.cols':            '3',
   *   'dashboard.widgets.0':       'revenue',
   *   'dashboard.widgets.1':       'orders',
   * })
   * // →
   * {
   *   notifications: { email: true, quiet_start: 22, timezone: 'Africa/Nairobi' },
   *   dashboard: { cols: 3, widgets: ['revenue', 'orders'] },
   * }
   */
  private unflatten(flat: Record<string, string>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [dotKey, raw] of Object.entries(flat)) {
      const parts = dotKey.split('.');
      let cursor = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const nextIsIndex = /^\d+$/.test(nextPart);

        if (!(part in cursor)) {
          // Initialise as array if the next segment is a numeric index
          cursor[part] = nextIsIndex ? [] : {};
        }

        cursor = cursor[part] as Record<string, unknown>;
      }

      const leaf = parts[parts.length - 1];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (cursor as any)[leaf] = this.autoCoerce(raw);
    }

    return result;
  }

  /** Best-effort type coercion — used by unflatten where no schema hint is available */
  private autoCoerce(raw: string): Primitive {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    const n = Number(raw);
    if (!isNaN(n) && raw.trim() !== '') return n;
    return raw;
  }
}
