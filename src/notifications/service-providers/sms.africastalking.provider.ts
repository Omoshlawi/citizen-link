import { Injectable } from '@nestjs/common';
import {
  ISmsProvider,
  ProviderResult,
  SmsPayload,
} from '../notification.interfaces';

@Injectable()
export class AfricasTalkingProvider implements ISmsProvider {
  readonly name = 'africastalking';

  send(payload: SmsPayload): Promise<ProviderResult> {
    throw new Error('Method not implemented.');
  }
}
