import { Injectable } from '@nestjs/common';
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

  constructor(private readonly providers: IEmailProvider[]) {}

  async dispatch(job: NotificationJob<EmailPayload>): Promise<ProviderResult> {
    const payload = job.payload;

    for (const provider of this.providers) {
      const result = await provider.send(payload);
      if (result.success) return result;
      // SendGrid failed — automatically try Mailgun next
    }

    return { success: false, error: 'All email providers exhausted' };
  }
}
