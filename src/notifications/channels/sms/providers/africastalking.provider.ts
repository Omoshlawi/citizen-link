import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { NotificationConfig } from '../../../notification.config';
import {
  ISmsProvider,
  ProviderResult,
  SmsPayload,
} from '../../../notification.interfaces';

@Injectable()
export class AfricasTalkingProvider implements ISmsProvider {
  readonly name = 'africastalking';

  constructor(private readonly config: NotificationConfig) {}

  async send(payload: SmsPayload): Promise<ProviderResult> {
    try {
      const params = new URLSearchParams({
        username: this.config.africastalkingUsername ?? '',
        to: payload.to,
        message: payload.body,
      });
      const senderId = payload.from ?? this.config.africastalkingSenderId;
      if (senderId) {
        params.set('from', senderId);
      }
      const response = await axios.post(
        'https://api.africastalking.com/version1/messaging',
        params.toString(),
        {
          headers: {
            apiKey: this.config.africastalkingApiKey ?? '',
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      const recipients: any[] = response.data?.SMSMessageData?.Recipients ?? [];
      const first = recipients[0];
      if (first?.status === 'Success') {
        return { success: true, messageId: first.messageId };
      }
      return { success: false, error: first?.status ?? 'Unknown error', raw: response.data };
    } catch (err: any) {
      return { success: false, error: err.message, raw: err.response?.data };
    }
  }
}
