/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '../../generated/prisma/enums';
import {
  EmailPayload,
  NotificationJob,
  NotificationQueue,
  PushPayload,
  SendNotificationOptions,
  SmsPayload,
} from './notification.interfaces';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../common/templates/templates.service';
import { NotificationMetadata } from '../common/templates';
import { NOTIFICATION_SLOTS } from '../common/templates/template.constants';
import { PushTokenService } from '../push-token/push-token.service';
import { UserSettingService } from 'src/common/settings/settings.user.service';
import { NOTIFICATION_QUEUES } from './notification.constants';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUES.HIGH)
    private readonly highQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUES.NORMAL)
    private readonly normalQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUES.LOW)
    private readonly lowQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly preferences: PushTokenService,
    private readonly userSettings: UserSettingService,
  ) {}

  private getEffectiveQueue(priority?: NotificationQueue): Queue {
    switch (priority) {
      case NotificationQueue.HIGH:
        return this.highQueue;
      case NotificationQueue.NORMAL:
        return this.normalQueue;
      case NotificationQueue.LOW:
        return this.lowQueue;
      default:
        return this.normalQueue;
    }
  }

  async send(options: SendNotificationOptions): Promise<void> {
    const {
      templateKey,
      inlineContent,
      channels,
      recipient,
      data = {},
      scheduledAt,
      delayMs,
      priority,
      userId,
      force = false,
    } = options;
    const queue = this.getEffectiveQueue(priority);

    // 1. Resolve content
    let resolved: {
      templateId?: string;
      channels: Record<string, boolean>;
      email: { subject: string; html: string } | null;
      sms: { body: string } | null;
      push: { title: string; body: string } | null;
    };

    if (templateKey) {
      // Use the new generic TemplateService
      const { templateId, slots, metadata } = await this.templates.renderAll(
        templateKey,
        { data },
        { validate: true },
      );

      // Read channel config from metadata
      const notifMeta = (metadata ?? {}) as unknown as NotificationMetadata;
      const channelConfig = notifMeta.channels ?? {
        email: true,
        sms: true,
        push: true,
      };

      resolved = {
        templateId,
        channels: channelConfig,
        email:
          channelConfig.email && slots[NOTIFICATION_SLOTS.EMAIL_BODY]
            ? {
                subject: slots[NOTIFICATION_SLOTS.EMAIL_SUBJECT] ?? '',
                html: slots[NOTIFICATION_SLOTS.EMAIL_BODY],
              }
            : null,
        sms:
          channelConfig.sms && slots[NOTIFICATION_SLOTS.SMS_BODY]
            ? { body: slots[NOTIFICATION_SLOTS.SMS_BODY] }
            : null,
        push:
          channelConfig.push && slots[NOTIFICATION_SLOTS.PUSH_TITLE]
            ? {
                title: slots[NOTIFICATION_SLOTS.PUSH_TITLE],
                body: slots[NOTIFICATION_SLOTS.PUSH_BODY] ?? '',
              }
            : null,
      };
    } else if (inlineContent) {
      resolved = {
        channels: {
          email: !!inlineContent.email,
          sms: !!inlineContent.sms,
          push: !!inlineContent.push,
        },
        email: inlineContent.email ?? null,
        sms: inlineContent.sms ?? null,
        push: inlineContent.push ?? null,
      };
    } else {
      throw new Error('Either templateKey or inlineContent must be provided');
    }

    // ── 2–5. Preferences, quiet hours, queue (unchanged from original) ──────
    const requestedChannels: NotificationChannel[] =
      channels ??
      Object.entries(resolved.channels)
        .filter(([, v]) => v)
        .map(([ch]) => ch.toUpperCase() as NotificationChannel);

    if (
      requestedChannels.includes(NotificationChannel.PUSH) &&
      userId &&
      !recipient.pushTokens?.length
    ) {
      recipient.pushTokens = await this.preferences.getPushTokens(userId);
    }

    let allowedChannels = requestedChannels;
    if (!force && userId) {
      allowedChannels = await this.userSettings.getAllowedChannels(
        userId,
        requestedChannels,
        templateKey,
      );
      const isQuiet = await this.userSettings.isQuietHours(userId);
      if (isQuiet) {
        allowedChannels = allowedChannels.filter(
          (ch) => ch === NotificationChannel.EMAIL,
        );
      }
    }

    const delay = scheduledAt
      ? Math.max(0, scheduledAt.getTime() - Date.now())
      : (delayMs ?? 0);

    const jobOptions = {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5_000 },
      delay,
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 86_400 * 7 },
    };

    for (const channel of allowedChannels) {
      const payload = this.buildPayload(
        channel,
        resolved,
        recipient,
        inlineContent,
      );
      if (!payload) continue;

      const log = await this.prisma.notificationLog.create({
        data: {
          templateId: resolved.templateId,
          channel: channel as any,
          provider: this.resolveProviderName(channel),
          recipientId: userId,
          to: this.extractTo(channel, recipient),
          subject:
            channel === NotificationChannel.EMAIL
              ? (payload as EmailPayload).subject
              : undefined,
          body:
            channel === NotificationChannel.EMAIL
              ? (payload as EmailPayload).html
              : channel === NotificationChannel.SMS
                ? (payload as SmsPayload).body
                : (payload as PushPayload).body,
          status: 'PENDING',
          scheduledAt,
        },
      });

      const job: NotificationJob<EmailPayload | SmsPayload | PushPayload> = {
        logId: log.id,
        channel,
        payload,
        attempt: 0,
      };
      await queue.add(channel.toLowerCase(), job, jobOptions);
      this.logger.log(`Queued ${channel} log:${log.id}`);
    }
  }

  private buildPayload(
    channel: NotificationChannel,
    resolved: any,
    recipient: SendNotificationOptions['recipient'],
    inline?: SendNotificationOptions['inlineContent'],
  ): EmailPayload | SmsPayload | PushPayload | null {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return recipient.email && resolved.email
          ? { to: recipient.email, ...resolved.email }
          : null;
      case NotificationChannel.SMS:
        return recipient.phone && resolved.sms
          ? { to: recipient.phone, body: resolved.sms.body }
          : null;
      case NotificationChannel.PUSH: {
        const token = recipient.pushTokens?.[0];
        return token && resolved.push
          ? { to: token, ...resolved.push, data: inline?.push?.data }
          : null;
      }
      default:
        return null;
    }
  }

  private extractTo(
    ch: NotificationChannel,
    r: SendNotificationOptions['recipient'],
  ): string {
    if (ch === NotificationChannel.EMAIL) return r.email ?? '';
    if (ch === NotificationChannel.SMS) return r.phone ?? '';
    return r.pushTokens?.[0] ?? '';
  }

  private resolveProviderName(ch: NotificationChannel): string {
    return { EMAIL: 'sendgrid', SMS: 'twilio', PUSH: 'expo' }[ch] ?? 'unknown';
  }
}
