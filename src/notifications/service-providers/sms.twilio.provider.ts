import { Injectable } from '@nestjs/common';
import {
  ISmsProvider,
  ProviderResult,
  SmsPayload,
} from '../notification.interfaces';

@Injectable()
export class TwilioProvider implements ISmsProvider {
  readonly name = 'twilio';

  send(payload: SmsPayload): Promise<ProviderResult> {
    throw new Error('Method not implemented.');
  }
}
