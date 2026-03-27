/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
  recipient?: NotificationRecipient;
  channels?: NotificationChannel[];
  userId: string;
  force?: boolean;
  scheduledAt?: Date;
  delayMs?: number;
  priority?: NotificationPriority;
  /** Passed to preference filtering only */
  templateKey?: string;
  eventTitle?: string;
  eventBody?: string;
  eventDescription?: string;
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
   * Send a notification using a DB-managed Handlebars template.
   *
   * This is the **preferred method** for all standard notifications.
   * Content is resolved from the `Template` table at job-processing time,
   * so template edits take effect immediately for queued-but-unprocessed jobs.
   *
   * ## What happens internally
   * 1. Channels are filtered against user preferences, quiet hours, and template
   *    `metadata.channels` overrides (unless `force: true`).
   * 2. One `NotificationEvent` is created as the umbrella inbox record for the user.
   * 3. One `NotificationLog` is created per allowed channel; for `PUSH`, one log
   *    per push token so each device has an independent retry lifecycle.
   * 4. All jobs are enqueued in a single `addBulk` call to the appropriate priority queue.
   *
   * ## Event inbox fields
   * Supply `eventTitle` / `eventBody` for a human-friendly inbox entry.
   * If omitted the title falls back to `templateKey` and body to `""`.
   * `eventDescription` is internal/admin context and is never shown to end users.
   *
   * @example — case confirmation
   * ```typescript
   * await this.notifications.sendFromTemplate({
   *   templateKey:      'case.confirmed',
   *   recipient:        { email: user.email, phone: user.phone },
   *   data:             { caseId: doc.id, caseRef: doc.referenceNumber },
   *   userId:           user.id,
   *   eventTitle:       'Case Confirmed',
   *   eventBody:        `Case ${doc.referenceNumber} has been confirmed.`,
   *   eventDescription: `Notify finder of confirmation of case ${doc.id}`,
   * });
   * ```
   *
   * @example — OTP (force-sent, high priority)
   * ```typescript
   * await this.notifications.sendFromTemplate({
   *   templateKey: 'auth.otp',
   *   recipient:   { phone: user.phone },
   *   data:        { otp, expiresInMinutes: 5 },
   *   userId:      user.id,
   *   force:       true,
   *   priority:    NotificationPriority.HIGH,
   *   eventTitle:  'OTP Code',
   *   eventBody:   'Your one-time password has been sent.',
   * });
   * ```
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
      eventTitle: options.eventTitle,
      eventBody: options.eventBody,
      eventDescription: options.eventDescription,
    });
  }

  /**
   * Send a notification using inline content — no DB template needed.
   *
   * Use this when content is constructed in code rather than managed in the
   * `Template` table (e.g. OTP codes, dynamic alerts, one-off system messages).
   * Only specify the channel objects you want — omitted channels are skipped entirely.
   *
   * ## What happens internally
   * Same pipeline as `sendFromTemplate`: preference filtering → `NotificationEvent`
   * creation → per-channel/per-token `NotificationLog` rows → `addBulk` enqueue.
   *
   * ## Event inbox fields
   * If `eventTitle` / `eventBody` are omitted, they are derived automatically:
   * - `eventTitle` → `push.title` → `email.subject` → `sms.body` (first 80 chars) → `"Notification"`
   * - `eventBody` → `push.body` → `email.subject` → `sms.body` → `""`
   *
   * @example — SMS OTP (force, high priority)
   * ```typescript
   * await this.notifications.sendInline({
   *   recipient:  { phone: user.phone },
   *   sms:        { body: `Your OTP is ${otp}. Valid for 5 minutes.` },
   *   userId:     user.id,
   *   force:      true,
   *   priority:   NotificationPriority.HIGH,
   *   eventTitle: 'OTP Code',
   *   eventBody:  'Your one-time password has been sent.',
   * });
   * ```
   *
   * @example — email + push (scheduled 1 hour from now)
   * ```typescript
   * await this.notifications.sendInline({
   *   recipient: { email: user.email, pushTokens: user.pushTokens },
   *   userId:    user.id,
   *   email:     { subject: 'Reminder', html: reminderHtml },
   *   push:      { title: 'Reminder', body: 'You have a pending action.' },
   *   delayMs:   60 * 60 * 1000,
   * });
   * ```
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
      eventTitle: options.eventTitle,
      eventBody: options.eventBody,
      eventDescription: options.eventDescription,
    });
  }

  /**
   * General-purpose send — accepts either a template key or inline content.
   *
   * This is a convenience wrapper that delegates to `sendFromTemplate()` when
   * `templateKey` is set, or to `sendInline()` when `inlineContent` is set.
   * Exactly one of the two must be provided; both or neither throws.
   *
   * **Prefer `sendFromTemplate()` or `sendInline()` at call sites** — they have
   * narrower types that make the intent obvious and reduce the risk of passing
   * both options accidentally.
   *
   * @throws {Error} if neither `templateKey` nor `inlineContent` is provided.
   *
   * @example
   * ```typescript
   * // Template-based
   * await this.notifications.send({ templateKey: 'case.matched', recipient, userId, data });
   *
   * // Inline
   * await this.notifications.send({ inlineContent: { sms: { body: 'Hi!' } }, recipient });
   * ```
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
   * Send the same template to multiple recipients in one efficient operation.
   *
   * Uses a single `addBulk()` call per priority queue, minimising Redis round-trips
   * regardless of recipient count. Ideal for marketing digests, batch reminders, and
   * any scenario where the same template is fanned out to a large audience.
   *
   * ## What happens internally
   * 1. **Channel filtering + push-token pre-load** — resolved in parallel for all
   *    recipients (`Promise.all`), respecting each user's own preferences.
   * 2. **Event + log creation** — one `NotificationEvent` per recipient (in parallel),
   *    then all `NotificationLog` rows created atomically in a `$transaction`.
   * 3. **Bulk enqueue** — all jobs added to the queue in one `addBulk` call.
   *
   * ## PUSH fan-out
   * For recipients with multiple devices, one log + one job is created per push token
   * so each device has its own independent retry lifecycle.
   *
   * ## Limitations
   * - Template-only: inline content is not supported for bulk sends.
   * - All recipients share the same `priority` queue.
   * - Individual `force` flags per recipient are supported.
   *
   * @example — weekly digest
   * ```typescript
   * await this.notifications.sendBulk({
   *   templateKey: 'marketing.digest',
   *   priority:    NotificationPriority.LOW,
   *   recipients:  users.map(u => ({
   *     userId:    u.id,
   *     recipient: { email: u.email, phone: u.phone },
   *     data:      { firstName: u.firstName, digestItems: u.digest },
   *   })),
   * });
   * ```
   *
   * @example — security alert (force, high priority)
   * ```typescript
   * await this.notifications.sendBulk({
   *   templateKey: 'security.alert',
   *   priority:    NotificationPriority.HIGH,
   *   recipients:  affectedUsers.map(u => ({
   *     userId:    u.id,
   *     recipient: { email: u.email },
   *     force:     true,
   *   })),
   * });
   * ```
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

    // Step 3: Create one NotificationEvent per recipient, then all logs atomically
    const eventByUserId = new Map<string, string>();
    const templateId = await this.resolveTemplateId(options.templateKey);
    await Promise.all(
      resolved
        .filter(({ r }) => !!r.userId)
        .map(async ({ r }) => {
          const event = await this.prisma.notificationEvent.create({
            data: {
              userId: r.userId!,
              templateId,
              title: options.templateKey,
              body: '',
            },
          });
          eventByUserId.set(r.userId!, event.id);
        }),
    );

    const logs = await this.prisma.$transaction(
      pairs.map(({ logData }) => {
        const userId = logData.userId as string | undefined;
        const eventId = userId ? eventByUserId.get(userId) : undefined;
        return this.prisma.notificationLog.create({
          data: {
            ...(eventId ? { eventId } : {}),
            channel: logData.channel,
            provider: logData.provider,
            recipientId: userId,
            userId,
            to: logData.to,
            body: logData.body,
            status: logData.status,
          },
        });
      }),
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
      eventTitle,
      eventBody,
      eventDescription,
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
      this.logger.log(`All channels suppressed for user:${userId}`);
      return;
    }

    // Resolve recipient — start from whatever the caller provided (or empty) and fill in
    // any missing contact fields from the user record so callers don't have to pre-load them.
    const resolvedRecipient: NotificationRecipient = { ...recipient };

    const needsEmail =
      allowedChannels.includes(NotificationChannel.EMAIL) &&
      !resolvedRecipient.email;
    const needsPhone =
      allowedChannels.includes(NotificationChannel.SMS) &&
      !resolvedRecipient.phone;

    if (needsEmail || needsPhone) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, phoneNumber: true },
      });
      if (user) {
        if (needsEmail) resolvedRecipient.email = user.email;
        if (needsPhone) resolvedRecipient.phone = user.phoneNumber ?? undefined;
      }
    }

    // Pre-load push tokens when PUSH is active and none are provided.
    // Tokens are fresh at enqueue time; stale ones are deactivated on send failure.
    if (
      allowedChannels.includes(NotificationChannel.PUSH) &&
      !resolvedRecipient.pushTokens?.length
    ) {
      resolvedRecipient.pushTokens = await this.pushToken.getPushTokens(userId);
    }

    const delay = scheduledAt
      ? Math.max(0, scheduledAt.getTime() - Date.now())
      : (delayMs ?? 0);

    // Resolve event title/body from options or fall back to source content
    const resolvedTitle =
      eventTitle ??
      (source.type === 'inline'
        ? (source.push?.title ??
          source.email?.subject ??
          source.sms?.body?.slice(0, 80))
        : templateKey) ??
      'Notification';
    const resolvedBody =
      eventBody ??
      (source.type === 'inline'
        ? (source.push?.body ?? source.email?.subject ?? source.sms?.body ?? '')
        : '') ??
      '';

    // Create one NotificationEvent to represent this logical notification
    const event = await this.prisma.notificationEvent.create({
      data: {
        userId,
        templateId:
          source.type === 'template'
            ? await this.resolveTemplateId(source.templateKey)
            : undefined,
        title: resolvedTitle,
        body: resolvedBody,
        description: eventDescription,
      },
    });

    const bulkJobs: Parameters<Queue['addBulk']>[0] = [];

    for (const channel of allowedChannels) {
      // Fan out one job per push token so each device gets its own log entry and retry lifecycle
      if (channel === NotificationChannel.PUSH) {
        const tokens = resolvedRecipient.pushTokens ?? [];
        if (!tokens.length) {
          this.logger.log(`Skipping PUSH — no tokens for user:${userId}`);
          continue;
        }
        for (const token of tokens) {
          const tokenRecipient = { ...resolvedRecipient, pushTokens: [token] };
          const log = await this.prisma.notificationLog.create({
            data: {
              eventId: event.id,
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
          eventId: event.id,
          channel,
          provider: this.resolveProviderName(channel),
          recipientId: userId,
          userId, // FK — required for ownership checks in NotificationsService
          to: this.extractTo(channel, resolvedRecipient),
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

  private async resolveTemplateId(
    templateKey: string,
  ): Promise<string | undefined> {
    const template = await this.prisma.template.findUnique({
      where: { key: templateKey },
      select: { id: true },
    });
    return template?.id;
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
