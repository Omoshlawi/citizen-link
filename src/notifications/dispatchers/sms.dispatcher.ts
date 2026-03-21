import { Injectable, Logger } from '@nestjs/common';
import {
  IChannelDispatcher,
  ISmsProvider,
  ProviderResult,
} from '../notification.interfaces';
import { NotificationChannel } from '../../../generated/prisma/enums';
import { NotificationJob } from '../notification.interfaces';
import { SmsPayload } from '../notification.interfaces';

@Injectable()
export class SmsDispatcher implements IChannelDispatcher {
  readonly channel = NotificationChannel.SMS;
  private readonly logger = new Logger(SmsDispatcher.name);
  constructor(private readonly providers: ISmsProvider[]) {}

  async dispatch(job: NotificationJob<SmsPayload>): Promise<ProviderResult> {
    if (!this.providers || this.providers.length === 0) {
      return {
        success: false,
        error: 'No sms notification providers configured',
      };
    }
    const payload = job.payload;
    const errors: string[] = [];
    for (const provider of this.providers) {
      this.logger.log(
        `Sending sms notification to ${payload.to} using ${provider.name}`,
      );
      const result = await provider.send(payload);
      if (result.success) return result;
      errors.push(`[${provider.name}] ${result.errorCode} - ${result.error}`);
    }

    return {
      success: false,
      error: `Failed to send sms notification. Exhausted all sms notification providers with errors: ${errors.join(', ')}`,
    };
  }
}
