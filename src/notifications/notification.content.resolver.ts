import { Injectable, Logger } from '@nestjs/common';
import { TemplatesService } from '../common/templates/templates.service';
import { UserSettingService } from '../common/settings/settings.user.service';
import { NOTIFICATION_SLOTS } from '../common/templates/template.constants';
import { NotificationMetadata } from '../common/templates';
import { NotificationChannel } from '../../generated/prisma/enums';
import {
  EmailPayload,
  NotificationJobSource,
  NotificationRecipient,
  PushPayload,
  SmsPayload,
} from './notification.interfaces';

@Injectable()
export class NotificationContentResolver {
  private readonly logger = new Logger(NotificationContentResolver.name);

  constructor(
    private readonly templates: TemplatesService,
    private readonly userSettings: UserSettingService,
  ) {}

  /**
   * Render source → full payload for a specific channel.
   * Returns null if the channel has no content or the recipient has no address for that channel.
   */
  async resolve(
    source: NotificationJobSource,
    channel: NotificationChannel,
    recipient: NotificationRecipient,
  ): Promise<EmailPayload | SmsPayload | PushPayload | null> {
    if (source.type === 'template') {
      return this.resolveFromTemplate(
        source.templateKey,
        source.data,
        channel,
        recipient,
      );
    }
    return this.resolveFromInline(source, channel, recipient);
  }

  /** Filter channels allowed by user preferences + quiet hours. */
  async filterAllowedChannels(
    channels: NotificationChannel[],
    userId?: string,
    force?: boolean,
    templateKey?: string,
  ): Promise<NotificationChannel[]> {
    if (force || !userId) return channels;

    const allowed = await this.userSettings.getAllowedChannels(
      userId,
      channels,
      templateKey,
    );

    const isQuiet = await this.userSettings.isQuietHours(userId);
    if (isQuiet) {
      // Intentional: email is allowed during quiet hours because it is non-intrusive
      // (no sound/vibration). SMS and push are suppressed to avoid disturbing the user.
      // Use force: true on critical sends (OTP, security alerts) to bypass this entirely.
      return allowed.filter((ch) => ch === NotificationChannel.EMAIL);
    }

    return allowed;
  }

  private async resolveFromTemplate(
    templateKey: string,
    data: Record<string, unknown>,
    channel: NotificationChannel,
    recipient: NotificationRecipient,
  ): Promise<EmailPayload | SmsPayload | PushPayload | null> {
    const { slots, metadata } = await this.templates.renderAll(
      templateKey,
      { data },
      { validate: true },
    );

    const notifMeta = (metadata ?? {}) as unknown as NotificationMetadata;
    const channelConfig = notifMeta.channels ?? {
      email: true,
      sms: true,
      push: true,
    };

    switch (channel) {
      case NotificationChannel.EMAIL: {
        if (
          !channelConfig.email ||
          !slots[NOTIFICATION_SLOTS.EMAIL_BODY] ||
          !recipient.email
        )
          return null;
        return {
          to: recipient.email,
          subject: slots[NOTIFICATION_SLOTS.EMAIL_SUBJECT] ?? '',
          html: slots[NOTIFICATION_SLOTS.EMAIL_BODY],
        };
      }
      case NotificationChannel.SMS: {
        if (
          !channelConfig.sms ||
          !slots[NOTIFICATION_SLOTS.SMS_BODY] ||
          !recipient.phone
        )
          return null;
        return { to: recipient.phone, body: slots[NOTIFICATION_SLOTS.SMS_BODY] };
      }
      case NotificationChannel.PUSH: {
        if (!channelConfig.push || !slots[NOTIFICATION_SLOTS.PUSH_TITLE])
          return null;
        const token = recipient.pushTokens?.[0];
        if (!token) return null;
        let pushData: Record<string, unknown> | undefined;
        if (slots[NOTIFICATION_SLOTS.PUSH_DATA]) {
          try {
            pushData = JSON.parse(
              slots[NOTIFICATION_SLOTS.PUSH_DATA],
            ) as Record<string, unknown>;
          } catch {
            this.logger.warn(
              `Invalid push_data JSON in template "${templateKey}"`,
            );
          }
        }
        return {
          to: token,
          title: slots[NOTIFICATION_SLOTS.PUSH_TITLE],
          body: slots[NOTIFICATION_SLOTS.PUSH_BODY] ?? '',
          data: pushData,
          channelId: slots[NOTIFICATION_SLOTS.PUSH_CHANNEL] ?? 'default-v2',
        };
      }
      default:
        return null;
    }
  }

  private resolveFromInline(
    source: NotificationJobSource & { type: 'inline' },
    channel: NotificationChannel,
    recipient: NotificationRecipient,
  ): EmailPayload | SmsPayload | PushPayload | null {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return source.email && recipient.email
          ? { to: recipient.email, ...source.email }
          : null;
      case NotificationChannel.SMS:
        return source.sms && recipient.phone
          ? { to: recipient.phone, body: source.sms.body }
          : null;
      case NotificationChannel.PUSH: {
        const token = recipient.pushTokens?.[0];
        return token && source.push
          ? { to: token, channelId: 'default-v2', ...source.push }
          : null;
      }
      default:
        return null;
    }
  }
}
