import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { NotificationConfig } from '../../../notification.config';
import {
  ISmsProvider,
  ProviderResult,
  SmsPayload,
} from '../../../notification.interfaces';

@Injectable()
export class TwilioProvider implements ISmsProvider {
  readonly name = 'twilio';

  constructor(private readonly config: NotificationConfig) {}

  async send(payload: SmsPayload): Promise<ProviderResult> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.twilioAccountSid}/Messages.json`;
      const params = new URLSearchParams({
        To: payload.to,
        From: payload.from ?? this.config.twilioFromNumber ?? '',
        Body: payload.body,
      });
      const response = await axios.post(url, params.toString(), {
        auth: {
          username: this.config.twilioAccountSid!,
          password: this.config.twilioAuthToken!,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return { success: true, messageId: response.data.sid };
    } catch (err: any) {
      const data = err.response?.data;
      return {
        success: false,
        error: data?.message ?? err.message,
        errorCode: String(data?.code ?? ''),
        raw: data,
      };
    }
  }
}
