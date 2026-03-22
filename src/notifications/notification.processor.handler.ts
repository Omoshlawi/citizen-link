/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDispatcher, PushDispatcher, SmsDispatcher } from './dispatchers';
import { UserSettingService } from '../common/settings/settings.user.service';
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
import { PushTokenService } from '../push-token/push-token.service';

@Injectable()
export class NotificationProcessorHandler {
  readonly logger = new Logger(NotificationProcessorHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailDispatcher,
    private readonly sms: SmsDispatcher,
    private readonly push: PushDispatcher,
    private readonly pushToken: PushTokenService,
    private readonly userSettings: UserSettingService,
  ) {}

  async process(job: Job<NotificationJob>): Promise<void> {
    const { logId, channel, payload } = job.data;
    this.logger.log(
      `Processing - Notification job ${job.id} for log ${logId} | Channel: ${channel} | Payload: ${JSON.stringify(payload)}`,
    );
    // Mark as queued on first attempt
    if (job.attemptsMade === 0) {
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { status: 'QUEUED', attempts: { increment: 1 } },
      });
    }

    try {
      let result: ProviderResult;

      switch (channel) {
        case NotificationChannel.EMAIL:
          result = await this.email.dispatch(
            job.data as NotificationJob<EmailPayload>,
          );
          break;
        case NotificationChannel.SMS:
          result = await this.sms.dispatch(
            job.data as NotificationJob<SmsPayload>,
          );
          break;
        case NotificationChannel.PUSH:
          result = await this.push.dispatch(
            job.data as NotificationJob<PushPayload>,
          );
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
          throw new Error(`Unknown channel: ${channel as any}`);
      }

      if (result.success) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            lastError: null,
          },
        });
        this.logger.log(`[${channel}] Delivered log:${logId}`);
      } else {
        throw new Error(result.error ?? 'Provider returned failure');
      }
    } catch (err: any) {
      this.logger.warn(
        `[${channel}] Attempt ${job.attemptsMade + 1} failed for log:${logId}: ${err.message}`,
      );
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { lastError: err.message, attempts: { increment: 1 } },
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
