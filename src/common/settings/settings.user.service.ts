import { Injectable } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { NotificationChannel } from '../../../generated/prisma/client';
import {
  NotificationSettingsSchema,
  SaveUserPreferenceDto,
} from './settings.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserSettingService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  async getNotificationPreferences(userId: string) {
    return this.settingsService.getObject(
      userId,
      'notification',
      NotificationSettingsSchema,
    );
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
  //   async savePreferences(userId: string, data: SaveUserPreferenceDto) {
  //     return this.settingsService.setObject(
  //       userId,
  //       'notification',
  //       data,
  //       NotificationSettingsSchema,
  //     );
  //   }
}
