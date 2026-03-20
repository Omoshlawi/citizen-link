import { Injectable } from '@nestjs/common';
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

  constructor(private readonly providers: IPushProvider[]) {}

  async dispatch(job: NotificationJob<PushPayload>): Promise<ProviderResult> {
    const payload = job.payload;

    for (const provider of this.providers) {
      const result = await provider.send(payload);
      if (result.success) return result;
      // SendGrid failed — automatically try Mailgun next
    }

    return { success: false, error: 'All push providers exhausted' };
  }
}
