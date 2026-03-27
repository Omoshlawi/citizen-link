/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushTokenService } from '../push-token/push-token.service';
import { NotificationContentResolver } from './notification.content.resolver';
import { EmailChannelService } from './channels/email/email.channel.service';
import { SmsChannelService } from './channels/sms/sms.channel.service';
import { PushChannelService } from './channels/push/push.channel.service';
import {
  EmailPayload,
  NotificationJob,
  ProviderResult,
  PushPayload,
  SmsPayload,
} from './notification.interfaces';
import { Job } from 'bullmq';
import {
  NotificationChannel,
  NotificationStatus,
} from '../../generated/prisma/enums';

@Injectable()
export class NotificationProcessorHandler {
  readonly logger = new Logger(NotificationProcessorHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentResolver: NotificationContentResolver,
    private readonly emailChannel: EmailChannelService,
    private readonly smsChannel: SmsChannelService,
    private readonly pushChannel: PushChannelService,
    private readonly pushToken: PushTokenService,
  ) {}

  async process(job: Job<NotificationJob>): Promise<void> {
    const { logId, channel, source, recipient, userId } = job.data;

    this.logger.log(
      `Processing job ${job.id} | log:${logId} | channel:${channel}`,
    );

    // Mark as queued on first attempt
    if (job.attemptsMade === 0) {
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { status: 'QUEUED' },
      });
    }

    try {
      // Auto-load push tokens when not present in recipient
      if (
        channel === NotificationChannel.PUSH &&
        !recipient.pushTokens?.length &&
        userId
      ) {
        recipient.pushTokens = await this.pushToken.getPushTokens(userId);
      }

      // Resolve template/inline source → channel-specific payload
      const payload = await this.contentResolver.resolve(
        source,
        channel,
        recipient,
      );

      // No content for this channel — mark SKIPPED and stop
      if (!payload) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: { status: 'SKIPPED' },
        });
        this.logger.log(
          `[${channel}] Skipped log:${logId} — no content for channel`,
        );
        return;
      }

      // Persist resolved body on the log before attempting send
      const body =
        channel === NotificationChannel.EMAIL
          ? (payload as EmailPayload).html
          : (payload as SmsPayload | PushPayload).body;

      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { body },
      });

      // Deliver via the appropriate channel service
      let result: ProviderResult;

      switch (channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailChannel.send(payload as EmailPayload);
          break;
        case NotificationChannel.SMS:
          result = await this.smsChannel.send(payload as SmsPayload);
          break;
        case NotificationChannel.PUSH:
          result = await this.pushChannel.send(payload as PushPayload);
          // Deactivate invalid Expo tokens automatically
          if (
            !result.success &&
            result.error?.includes('DeviceNotRegistered')
          ) {
            await this.pushToken.deactivatePushToken(
              (payload as PushPayload).to,
            );
          }
          break;
        default:
          throw new Error(`Unknown channel: ${channel as string}`);
      }

      if (result.success) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            lastError: null,
            provider: result.providerName ?? 'unknown',
            attempts: job.attemptsMade + 1,
          },
        });
        this.logger.log(`[${channel}] Delivered log:${logId} via ${result.providerName ?? 'unknown'}`);
      } else {
        throw new Error(result.error ?? 'Provider returned failure');
      }
    } catch (err: any) {
      this.logger.warn(
        `[${channel}] Attempt ${job.attemptsMade + 1} failed for log:${logId}: ${err.message}`,
      );
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { lastError: err.message, attempts: job.attemptsMade + 1 },
      });
      // Re-throw so BullMQ triggers retry/backoff
      throw err;
    }
  }

  async onFailed(job: Job<NotificationJob>, err: Error): Promise<void> {
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await this.prisma.notificationLog.update({
        where: { id: job.data.logId },
        data: { status: NotificationStatus.FAILED, lastError: err.message },
      });
      this.logger.error(
        `[${job.data.channel}] Permanently failed log:${job.data.logId} after ${job.attemptsMade} attempts`,
      );
    }
  }
}
