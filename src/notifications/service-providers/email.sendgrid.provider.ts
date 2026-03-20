import { Injectable } from '@nestjs/common';
import {
  IEmailProvider,
  ProviderResult,
  EmailPayload,
} from '../notification.interfaces';

@Injectable()
export class SendGridProvider implements IEmailProvider {
  readonly name = 'sendgrid';

  async send(payload: EmailPayload): Promise<ProviderResult> {
    throw new Error('Method not implemented.');
  }
}
