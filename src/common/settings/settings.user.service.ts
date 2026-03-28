import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../../../generated/prisma/client';
import {
  NotificationSettingsSchema,
  SaveUserPreferenceDto,
} from './settings.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsUtils } from './settings.utils';
import z from 'zod';

@Injectable()
export class UserSettingService {
  private readonly logger = new Logger(UserSettingService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    // nestie() returns undefined for empty input; fall back to {} so schema defaults apply cleanly
    const obj = SettingsUtils.nestSettings(rows, prefix) ?? {};

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

  async getNotificationPreferences(userId: string) {
    return this.getObject(userId, 'notification', NotificationSettingsSchema);
  }

  /**
   * Returns which channels are allowed for a given user and event type.
   * Returns all channels if userId is not provided.
   */
  async getAllowedChannels(
    userId: string | undefined,
    requestedChannels: NotificationChannel[],
    templateKey?: string,
  ): Promise<NotificationChannel[]> {
    if (!userId) return requestedChannels;

    const pref = await this.getNotificationPreferences(userId);

    if (!pref) return requestedChannels; // no preferences set → allow all

    const globalMap: Record<NotificationChannel, boolean> = {
      [NotificationChannel.EMAIL]: pref.email,
      [NotificationChannel.SMS]: pref.sms,
      [NotificationChannel.PUSH]: pref.push,
    };

    // Per-template-key overrides
    const overrides =
      templateKey && pref.overrides ? (pref.overrides[templateKey] ?? {}) : {};

    return requestedChannels.filter((ch) => {
      const key = ch.toLowerCase();
      if (key in overrides) return overrides[key];
      return globalMap[ch] ?? true;
    });
  }

  /** Check if current time is inside user's quiet hours */
  async isQuietHours(userId: string): Promise<boolean> {
    const pref = await this.getNotificationPreferences(userId);

    if (!pref || pref.quietHoursStart == null || pref.quietHoursEnd == null) {
      return false;
    }

    const now = new Date();
    const tz = pref.timezone ?? 'UTC';

    // Get hour in user's timezone
    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tz,
      }).format(now),
    );

    const { quietHoursStart: start, quietHoursEnd: end } = pref;

    // Handle overnight ranges (e.g. 22 → 8)
    if (start > end) return hour >= start || hour < end;
    return hour >= start && hour < end;
  }

  /** Save or update preferences for a user */
  async savePreferences(userId: string, data: SaveUserPreferenceDto) {
    return this.setObject(
      userId,
      'notification',
      data,
      NotificationSettingsSchema,
    );
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
