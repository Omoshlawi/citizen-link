import { Injectable, Logger } from '@nestjs/common';
import {
  IChannelDispatcher,
  IPushProvider,
  NotificationJob,
  ProviderResult,
  PushPayload,
} from '../notification.interfaces';
import { NotificationChannel } from '../../../generated/prisma/enums';

@Injectable()
export class PushDispatcher implements IChannelDispatcher {
  readonly channel = NotificationChannel.PUSH;
  private readonly logger = new Logger(PushDispatcher.name);

  constructor(private readonly providers: IPushProvider[]) {}

  async dispatch(job: NotificationJob<PushPayload>): Promise<ProviderResult> {
    if (!this.providers || this.providers.length === 0) {
      return {
        success: false,
        error: 'No push notification providers configured',
      };
    }
    const payload = job.payload;
    const errors: string[] = [];
    for (const provider of this.providers) {
      this.logger.log(
        `Sending push notification to ${payload.to} using ${provider.name}`,
      );
      const result = await provider.send(payload);
      if (result.success) return result;
      errors.push(`[${provider.name}] ${result.errorCode} - ${result.error}`);
    }

    return {
      success: false,
      error:
        'Failed to send push notification. Exhausted all push notification providers with errors: ' +
        errors.join(', '),
    };
  }
}
