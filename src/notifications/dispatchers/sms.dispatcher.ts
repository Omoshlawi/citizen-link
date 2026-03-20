import { Injectable } from '@nestjs/common';
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

  constructor(private readonly providers: ISmsProvider[]) {}

  async dispatch(job: NotificationJob<SmsPayload>): Promise<ProviderResult> {
    const payload = job.payload;

    for (const provider of this.providers) {
      const result = await provider.send(payload);
      if (result.success) return result;
      // SendGrid failed — automatically try Mailgun next
    }

    return { success: false, error: 'All sms providers exhausted' };
  }
}
