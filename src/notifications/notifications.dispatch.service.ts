import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PushTokenService } from '../push-token/push-token.service';
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
    private readonly pushToken: PushTokenService,
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
    const requestedChannels = [
      NotificationChannel.EMAIL,
      NotificationChannel.SMS,
      NotificationChannel.PUSH,
    ];

    // Step 1: Resolve allowed channels and pre-load push tokens for all recipients in parallel
    const resolved = await Promise.all(
      options.recipients.map(async (r) => {
        const allowedChannels =
          await this.contentResolver.filterAllowedChannels(
            requestedChannels,
            r.userId,
            r.force,
            options.templateKey,
          );
        const recipient = { ...r.recipient };
        if (
          allowedChannels.includes(NotificationChannel.PUSH) &&
          !recipient.pushTokens?.length &&
          r.userId
        ) {
          recipient.pushTokens = await this.pushToken.getPushTokens(r.userId);
        }
        return { r, recipient, allowedChannels };
      }),
    );

    // Step 2: Build (logCreateData, jobData) pairs for every channel of every recipient
    type LogCreateData = Parameters<
      typeof this.prisma.notificationLog.create
    >[0]['data'];
    type Pair = {
      logData: LogCreateData;
      jobData: Omit<NotificationJob, 'logId'>;
    };

    const pairs: Pair[] = [];
    for (const { r, recipient, allowedChannels } of resolved) {
      if (!allowedChannels.length) continue;
      for (const channel of allowedChannels) {
        // Fan out one job per push token so each device gets its own log entry and retry lifecycle
        if (channel === NotificationChannel.PUSH) {
          const tokens = recipient.pushTokens ?? [];
          if (!tokens.length) continue;
          for (const token of tokens) {
            pairs.push({
              logData: {
                channel,
                provider: this.resolveProviderName(channel),
                recipientId: r.userId,
                userId: r.userId,
                to: token,
                body: '',
                status: 'PENDING',
              },
              jobData: {
                channel,
                source: {
                  type: 'template',
                  templateKey: options.templateKey,
                  data: r.data ?? {},
                },
                recipient: { ...recipient, pushTokens: [token] },
                userId: r.userId,
                force: r.force ?? false,
                attempt: 0,
              },
            });
          }
          continue;
        }

        pairs.push({
          logData: {
            channel,
            provider: this.resolveProviderName(channel),
            recipientId: r.userId,
            userId: r.userId, // FK — required for ownership checks
            to: this.extractTo(channel, recipient),
            body: '',
            status: 'PENDING',
          },
          jobData: {
            channel,
            source: {
              type: 'template',
              templateKey: options.templateKey,
              data: r.data ?? {},
            },
            recipient,
            userId: r.userId,
            force: r.force ?? false,
            attempt: 0,
          },
        });
      }
    }

    if (!pairs.length) return;

    // Step 3: Create all logs atomically in a single transaction
    const logs = await this.prisma.$transaction(
      pairs.map(({ logData }) =>
        this.prisma.notificationLog.create({ data: logData }),
      ),
    );

    // Step 4: Enqueue all jobs in a single addBulk call
    await queue.addBulk(
      logs.map((log, i) => ({
        name: pairs[i].jobData.channel.toLowerCase(),
        data: { ...pairs[i].jobData, logId: log.id } as NotificationJob,
        opts: {},
      })),
    );

    this.logger.log(
      `Bulk enqueued ${logs.length} jobs for template:${options.templateKey} across ${options.recipients.length} recipients`,
    );
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

    // Pre-load push tokens at dispatch time so the processor worker avoids an extra DB round-trip.
    // Tokens are fresh at enqueue time; any that become stale will be deactivated on send failure.
    const resolvedRecipient = { ...recipient };
    if (
      allowedChannels.includes(NotificationChannel.PUSH) &&
      !resolvedRecipient.pushTokens?.length &&
      userId
    ) {
      resolvedRecipient.pushTokens = await this.pushToken.getPushTokens(userId);
    }

    const delay = scheduledAt
      ? Math.max(0, scheduledAt.getTime() - Date.now())
      : (delayMs ?? 0);

    const bulkJobs: Parameters<Queue['addBulk']>[0] = [];

    for (const channel of allowedChannels) {
      // Fan out one job per push token so each device gets its own log entry and retry lifecycle
      if (channel === NotificationChannel.PUSH) {
        const tokens = resolvedRecipient.pushTokens ?? [];
        if (!tokens.length) {
          this.logger.log(
            `Skipping PUSH — no tokens for user:${userId ?? 'anonymous'}`,
          );
          continue;
        }
        for (const token of tokens) {
          const tokenRecipient = { ...resolvedRecipient, pushTokens: [token] };
          const log = await this.prisma.notificationLog.create({
            data: {
              channel,
              provider: this.resolveProviderName(channel),
              recipientId: userId,
              userId,
              to: token,
              body: '',
              status: 'PENDING',
              scheduledAt,
            },
          });
          bulkJobs.push({
            name: channel.toLowerCase(),
            data: {
              logId: log.id,
              channel,
              source,
              recipient: tokenRecipient,
              userId,
              force,
              attempt: 0,
            } satisfies NotificationJob,
            opts: { delay },
          });
          this.logger.log(`Queued ${channel} log:${log.id} → token:${token}`);
        }
        continue;
      }

      const log = await this.prisma.notificationLog.create({
        data: {
          channel,
          provider: this.resolveProviderName(channel),
          recipientId: userId,
          userId, // FK — required for ownership checks in NotificationsService
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
        recipient: resolvedRecipient,
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
