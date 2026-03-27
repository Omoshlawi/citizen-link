import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel } from '../../generated/prisma/enums';
import { NOTIFICATION_QUEUES } from './notification.constants';
import { NotificationContentResolver } from './notification.content.resolver';
import {
  NotificationJob,
  NotificationJobSource,
  NotificationPriority,
  NotificationRecipient,
  SendInlineOptions,
  SendNotificationOptions,
  SendTemplateOptions,
} from './notification.interfaces';

interface EnqueueOptions {
  source: NotificationJobSource;
  recipient: NotificationRecipient;
  channels?: NotificationChannel[];
  userId?: string;
  force?: boolean;
  scheduledAt?: Date;
  delayMs?: number;
  priority?: NotificationPriority;
  /** Passed to preference filtering only */
  templateKey?: string;
}

@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUES.HIGH) private readonly highQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUES.NORMAL)
    private readonly normalQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUES.LOW) private readonly lowQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly contentResolver: NotificationContentResolver,
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
    return this.enqueue({
      source: {
        type: 'template',
        templateKey: options.templateKey,
        data: options.data ?? {},
      },
      recipient: options.recipient,
      channels: options.channels,
      userId: options.userId,
      force: options.force,
      scheduledAt: options.scheduledAt,
      delayMs: options.delayMs,
      priority: options.priority,
      templateKey: options.templateKey,
    });
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
   */
  async sendInline(options: SendInlineOptions): Promise<void> {
    return this.enqueue({
      source: {
        type: 'inline',
        email: options.email,
        sms: options.sms,
        push: options.push,
      },
      recipient: options.recipient,
      channels: options.channels,
      userId: options.userId,
      force: options.force,
      scheduledAt: options.scheduledAt,
      delayMs: options.delayMs,
      priority: options.priority,
    });
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
      recipient: NotificationRecipient;
      data?: Record<string, unknown>;
      force?: boolean;
    }>;
  }): Promise<void> {
    const queue = this.resolveQueue(options.priority);
    for (const r of options.recipients) {
      await this.enqueue(
        {
          source: {
            type: 'template',
            templateKey: options.templateKey,
            data: r.data ?? {},
          },
          recipient: r.recipient,
          userId: r.userId,
          force: r.force,
          priority: options.priority,
          templateKey: options.templateKey,
        },
        queue,
      );
    }
  }

  private async enqueue(options: EnqueueOptions, queue?: Queue): Promise<void> {
    const {
      source,
      recipient,
      channels,
      userId,
      force = false,
      scheduledAt,
      delayMs,
      priority,
      templateKey,
    } = options;

    const effectiveQueue = queue ?? this.resolveQueue(priority);

    // Determine which channels to attempt
    const requestedChannels = channels ?? [
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.PUSH,
    ];

    // Filter channels by user preferences + quiet hours (fast DB read, kept here to avoid queuing suppressed jobs)
    const allowedChannels = await this.contentResolver.filterAllowedChannels(
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

    const bulkJobs: Parameters<Queue['addBulk']>[0] = [];

    for (const channel of allowedChannels) {
      const log = await this.prisma.notificationLog.create({
        data: {
          channel,
          provider: this.resolveProviderName(channel),
          recipientId: userId,
          to: this.extractTo(channel, recipient),
          body: '',
          status: 'PENDING',
          scheduledAt,
        },
      });

      const job: NotificationJob = {
        logId: log.id,
        channel,
        source,
        recipient,
        userId,
        force,
        attempt: 0,
      };

      bulkJobs.push({
        name: channel.toLowerCase(),
        data: job,
        opts: { delay },
      });

      this.logger.log(`Queued ${channel} log:${log.id}`);
    }

    if (bulkJobs.length) {
      await effectiveQueue.addBulk(bulkJobs);
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

  private extractTo(
    channel: NotificationChannel,
    recipient: NotificationRecipient,
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

  private resolveProviderName(channel: NotificationChannel): string {
    const map: Partial<Record<NotificationChannel, string>> = {
      [NotificationChannel.EMAIL]: 'mailpit',
      [NotificationChannel.SMS]: 'twilio',
      [NotificationChannel.PUSH]: 'expo',
    };
    return map[channel] ?? 'unknown';
  }
}
