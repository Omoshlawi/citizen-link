import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../common/templates/templates.service';
import { PushTokenService } from '../push-token/push-token.service';
import { UserSettingService } from '../common/settings/settings.user.service';
import { NotificationChannel } from '../../generated/prisma/enums';
import { NOTIFICATION_QUEUES } from './notification.constants';
import { NOTIFICATION_SLOTS } from '../common/templates/template.constants';
import { NotificationMetadata } from '../common/templates';
import {
  EmailPayload,
  SmsPayload,
  PushPayload,
  NotificationJob,
  NotificationPriority,
  SendNotificationOptions,
  SendTemplateOptions,
  SendInlineOptions,
} from './notification.interfaces';

interface ResolvedContent {
  templateId?: string;
  channels: Record<string, boolean>;
  email: { subject: string; html: string } | null;
  sms: { body: string } | null;
  push: { title: string; body: string; data?: Record<string, unknown> } | null;
}

const BASE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { age: 86_400 },
  removeOnFail: { age: 86_400 * 7 },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUES.HIGH) private readonly highQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUES.NORMAL)
    private readonly normalQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUES.LOW) private readonly lowQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly pushTokens: PushTokenService,
    private readonly userSettings: UserSettingService,
  ) {}

  /**
   * Send using a DB-managed Handlebars template.
   * Preferred for all standard notifications.
   *
   * @example
   * await this.notifications.sendFromTemplate({
   *   templateKey: 'order.confirmed',
   *   recipient:   { email: user.email, phone: user.phone },
   *   data:        { orderId: order.id, total: order.total },
   *   userId:      user.id,
   * });
   */
  async sendFromTemplate(options: SendTemplateOptions): Promise<void> {
    const resolved = await this.resolveTemplate(
      options.templateKey,
      options.data ?? {},
    );
    await this.dispatch(resolved, options);
  }

  /**
   * Send using inline content — no DB template needed.
   * Only specify the channels you want — unused channels are ignored.
   *
   * @example — SMS only (OTP)
   * await this.notifications.sendInline({
   *   recipient: { phone: user.phone },
   *   sms:       { body: `Your OTP is ${otp}. Valid for 5 minutes.` },
   *   force:     true,
   * });
   *
   * @example — push only
   * await this.notifications.sendInline({
   *   recipient: { pushTokens: [token] },
   *   push:      { title: 'New message', body: preview },
   *   userId:    user.id,
   * });
   *
   * @example — all channels
   * await this.notifications.sendInline({
   *   recipient: { email: user.email, phone: user.phone },
   *   email:     { subject: 'Security alert', html },
   *   sms:       { body: 'New login detected on your account' },
   *   push:      { title: 'Security alert', body: 'New login detected' },
   *   force:     true,
   * });
   */
  async sendInline(options: SendInlineOptions): Promise<void> {
    const resolved = this.resolveInline(options);
    await this.dispatch(resolved, options);
  }

  /**
   * General purpose send — accepts either templateKey or inlineContent.
   * Prefer sendFromTemplate() or sendInline() for cleaner call sites.
   */
  async send(options: SendNotificationOptions): Promise<void> {
    if (options.templateKey) {
      return this.sendFromTemplate({
        ...options,
        templateKey: options.templateKey,
      });
    }
    if (options.inlineContent) {
      return this.sendInline({
        ...options,
        ...options.inlineContent,
      });
    }
    throw new Error('Either templateKey or inlineContent must be provided');
  }

  /**
   * Send the same template to multiple recipients.
   * Uses addBulk() — one Redis round trip per page.
   *
   * @example
   * await this.notifications.sendBulk({
   *   templateKey: 'marketing.digest',
   *   priority:    NotificationPriority.LOW,
   *   recipients:  users.map(u => ({
   *     userId:    u.id,
   *     recipient: { email: u.email, phone: u.phone },
   *     data:      { firstName: u.firstName },
   *   })),
   * });
   */
  async sendBulk(options: {
    templateKey: string;
    priority?: NotificationPriority;
    recipients: Array<{
      userId?: string;
      recipient: SendNotificationOptions['recipient'];
      data?: Record<string, unknown>;
      force?: boolean;
    }>;
  }): Promise<void> {
    const queue = this.resolveQueue(options.priority);
    for (const r of options.recipients) {
      const resolved = await this.resolveTemplate(
        options.templateKey,
        r.data ?? {},
      );
      await this.dispatch(
        resolved,
        { ...r, templateKey: options.templateKey, priority: options.priority },
        queue,
      );
    }
  }

  private async resolveTemplate(
    templateKey: string,
    data: Record<string, unknown>,
  ): Promise<ResolvedContent> {
    const { templateId, slots, metadata } = await this.templates.renderAll(
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

    let pushData: Record<string, unknown> | undefined;
    if (slots[NOTIFICATION_SLOTS.PUSH_DATA]) {
      try {
        pushData = JSON.parse(slots[NOTIFICATION_SLOTS.PUSH_DATA]) as Record<
          string,
          unknown
        >;
      } catch {
        this.logger.warn(`Invalid push_data JSON in template "${templateKey}"`);
      }
    }

    return {
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
              data: pushData,
            }
          : null,
    };
  }

  private resolveInline(options: SendInlineOptions): ResolvedContent {
    return {
      channels: {
        email: !!options.email,
        sms: !!options.sms,
        push: !!options.push,
      },
      email: options.email ?? null,
      sms: options.sms ?? null,
      push: options.push ?? null,
    };
  }

  private async dispatch(
    resolved: ResolvedContent,
    options: Pick<
      SendNotificationOptions,
      | 'channels'
      | 'recipient'
      | 'userId'
      | 'force'
      | 'scheduledAt'
      | 'delayMs'
      | 'priority'
      | 'templateKey'
    >,
    queue?: Queue,
  ): Promise<void> {
    const {
      channels,
      recipient,
      userId,
      force = false,
      scheduledAt,
      delayMs,
      priority,
      templateKey,
    } = options;

    const effectiveQueue = queue ?? this.resolveQueue(priority);

    // Auto-load push tokens when not provided
    if (
      !recipient.pushTokens?.length &&
      userId &&
      (channels?.includes(NotificationChannel.PUSH) ?? resolved.channels.push)
    ) {
      recipient.pushTokens = await this.pushTokens.getPushTokens(userId);
    }

    // Filter channels by preferences + quiet hours
    const requestedChannels = this.resolveRequestedChannels(channels, resolved);
    const allowedChannels = await this.filterByPreferences(
      requestedChannels,
      userId,
      force,
      templateKey,
    );

    if (!allowedChannels.length) {
      this.logger.log(
        `All channels suppressed for user:${userId ?? 'anonymous'}`,
      );
      return;
    }

    const delay = scheduledAt
      ? Math.max(0, scheduledAt.getTime() - Date.now())
      : (delayMs ?? 0);

    // Build jobs and log rows together
    const bulkJobs: Parameters<Queue['addBulk']>[0] = [];

    for (const channel of allowedChannels) {
      const payload = this.buildPayload(channel, resolved, recipient);
      if (!payload) continue;

      const log = await this.prisma.notificationLog.create({
        data: {
          templateId: resolved.templateId,
          channel: channel,
          provider: this.resolveProviderName(channel),
          recipientId: userId,
          to: this.extractTo(channel, recipient),
          subject:
            channel === NotificationChannel.EMAIL
              ? (payload as EmailPayload).subject
              : undefined,
          body: this.extractBody(channel, payload),
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

      bulkJobs.push({
        name: channel.toLowerCase(),
        data: job,
        opts: { ...BASE_JOB_OPTIONS, delay },
      });

      this.logger.log(`Queued ${channel} log:${log.id}`);
    }

    // One Redis round trip for all channels
    if (bulkJobs.length) {
      await effectiveQueue.addBulk(bulkJobs);
    }

    // Log skipped channels for audit
    const skipped = requestedChannels.filter(
      (ch) => !allowedChannels.includes(ch),
    );
    if (skipped.length) {
      await this.prisma.notificationLog.createMany({
        data: skipped.map((ch) => ({
          templateId: resolved.templateId,
          channel: ch,
          provider: this.resolveProviderName(ch),
          recipientId: userId,
          to: this.extractTo(ch, recipient),
          body: '',
          status: 'SKIPPED' as const,
        })),
      });
    }
  }

  private resolveQueue(priority?: NotificationPriority): Queue {
    switch (priority) {
      case NotificationPriority.HIGH:
        return this.highQueue;
      case NotificationPriority.LOW:
        return this.lowQueue;
      default:
        return this.normalQueue;
    }
  }

  private resolveRequestedChannels(
    channels: NotificationChannel[] | undefined,
    resolved: ResolvedContent,
  ): NotificationChannel[] {
    return (
      channels ??
      Object.entries(resolved.channels)
        .filter(([, enabled]) => enabled)
        .map(([ch]) => ch.toUpperCase() as NotificationChannel)
    );
  }

  private async filterByPreferences(
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
      return allowed.filter((ch) => ch === NotificationChannel.EMAIL);
    }

    return allowed;
  }

  private buildPayload(
    channel: NotificationChannel,
    resolved: ResolvedContent,
    recipient: SendNotificationOptions['recipient'],
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
        return token && resolved.push ? { to: token, ...resolved.push } : null;
      }
      default:
        return null;
    }
  }

  private extractTo(
    channel: NotificationChannel,
    recipient: SendNotificationOptions['recipient'],
  ): string {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return recipient.email ?? '';
      case NotificationChannel.SMS:
        return recipient.phone ?? '';
      case NotificationChannel.PUSH:
        return recipient.pushTokens?.[0] ?? '';
      default:
        return '';
    }
  }

  private extractBody(
    channel: NotificationChannel,
    payload: EmailPayload | SmsPayload | PushPayload,
  ): string {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return (payload as EmailPayload).html;
      case NotificationChannel.SMS:
        return (payload as SmsPayload).body;
      case NotificationChannel.PUSH:
        return (payload as PushPayload).body;
      default:
        return '';
    }
  }

  private resolveProviderName(channel: NotificationChannel): string {
    const map: Partial<Record<NotificationChannel, string>> = {
      [NotificationChannel.EMAIL]: 'sendgrid',
      [NotificationChannel.SMS]: 'twilio',
      [NotificationChannel.PUSH]: 'expo',
    };
    return map[channel] ?? 'unknown';
  }
}
