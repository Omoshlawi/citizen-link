import { Injectable, Logger } from '@nestjs/common';
import {
  IChannelDispatcher,
  IEmailProvider,
  ProviderResult,
} from '../notification.interfaces';
import { NotificationChannel } from '../../../generated/prisma/enums';
import { NotificationJob } from '../notification.interfaces';
import { EmailPayload } from '../notification.interfaces';

@Injectable()
export class EmailDispatcher implements IChannelDispatcher {
  readonly channel = NotificationChannel.EMAIL;
  private readonly logger = new Logger(EmailDispatcher.name);
  constructor(private readonly providers: IEmailProvider[]) {}

  async dispatch(job: NotificationJob<EmailPayload>): Promise<ProviderResult> {
    if (!this.providers || this.providers.length === 0) {
      return {
        success: false,
        error: 'No email notification providers configured',
      };
    }
    const payload = job.payload;
    const errors: string[] = [];
    for (const provider of this.providers) {
      this.logger.log(
        `Sending email notification to ${payload.to} using ${provider.name}`,
      );
      const result = await provider.send(payload);
      if (result.success) return result;
      errors.push(`[${provider.name}] ${result.errorCode} - ${result.error}`);
    }

    return {
      success: false,
      error:
        'Failed to send email notification. Exhausted all email notification providers with errors: ' +
        errors.join(', '),
    };
  }
}
