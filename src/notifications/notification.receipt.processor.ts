import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PushTokenService } from '../push-token/push-token.service';
import { PushChannelService } from './channels/push/push.channel.service';
import { NOTIFICATION_QUEUES } from './notification.constants';
import { PushReceiptJob } from './notification.interfaces';

// Error codes that mean the token is permanently dead — deactivate it immediately
const PERMANENT_ERRORS = new Set(['DeviceNotRegistered', 'InvalidCredentials']);

@Processor(NOTIFICATION_QUEUES.PUSH_RECEIPT, { concurrency: 5 })
export class NotificationReceiptProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationReceiptProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushChannel: PushChannelService,
    private readonly pushToken: PushTokenService,
  ) {
    super();
  }

  async process(job: Job<PushReceiptJob>): Promise<void> {
    const { logId, receiptId, token } = job.data;
    this.logger.log(`Checking push receipt ${receiptId} for log:${logId}`);

    const results = await this.pushChannel.checkReceipts([receiptId]);
    const result = results.get(receiptId);

    if (!result) {
      // Expo doesn't retain receipts indefinitely — missing receipt after the window is not an error
      this.logger.warn(
        `No receipt found for ID ${receiptId} (log:${logId}) — may have expired`,
      );
      return;
    }

    if (result.success) {
      this.logger.log(`Push confirmed delivered: log:${logId}`);
      return;
    }

    const errorCode = result.errorCode ?? 'UnknownError';
    this.logger.warn(
      `Push receipt failure [${errorCode}] for log:${logId}: ${result.error ?? ''}`,
    );

    await this.prisma.notificationLog.update({
      where: { id: logId },
      data: {
        status: NotificationStatus.FAILED,
        lastError: (result.error ?? errorCode).slice(0, 500),
      },
    });

    if (PERMANENT_ERRORS.has(errorCode)) {
      this.logger.warn(`Deactivating push token due to ${errorCode}: ${token}`);
      await this.pushToken.deactivatePushToken(token);
    }
  }
}
