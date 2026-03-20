import { Injectable } from '@nestjs/common';
import {
  IPushProvider,
  ProviderResult,
  PushPayload,
} from '../notification.interfaces';

@Injectable()
export class ExpoPushProvider implements IPushProvider {
  readonly name = 'expo';

  async send(payload: PushPayload): Promise<ProviderResult> {
    throw new Error('Method not implemented.');
  }
}
