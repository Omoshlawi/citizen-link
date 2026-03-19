import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import z from 'zod';
import { SettingsUtils } from './settings.utils';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemSettingService {
  private readonly logger = new Logger(SystemSettingService.name);
  private readonly systemCache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async setSystem<S extends z.ZodTypeAny>(
    key: string,
    value: string,
    schema: S,
    opts: { description?: string; isPublic?: boolean; updatedBy?: string } = {},
  ): Promise<z.infer<S>> {
    const parsed = this.parse(schema, value, key);
    const stored = SettingsUtils.serialize(parsed);
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

  async getPublicSystem(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({
      where: { userId: '*', isPublic: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}
