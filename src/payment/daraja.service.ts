import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DarajaConfig } from './daraja.config';

interface DarajaTokenResponse {
  access_token: string;
  expires_in: string;
}

export interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface StkCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number; // 0 = success
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

@Injectable()
export class DarajaService {
  private readonly logger = new Logger(DarajaService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly config: DarajaConfig) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`,
    ).toString('base64');

    const res = await fetch(
      `${this.config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );

    if (!res.ok) {
      this.logger.error(`Daraja OAuth failed: ${res.status}`);
      throw new ServiceUnavailableException('Payment provider unavailable');
    }

    const data = (await res.json()) as DarajaTokenResponse;
    this.cachedToken = data.access_token;
    // expire 60s before actual expiry to avoid edge-case stale tokens
    this.tokenExpiresAt = Date.now() + (Number(data.expires_in) - 60) * 1000;
    return this.cachedToken;
  }

  /** Generates the base64 password required by Daraja STK push */
  private buildPassword(): { password: string; timestamp: string } {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const raw = `${this.config.shortcode}${this.config.passkey}${timestamp}`;
    const password = Buffer.from(raw).toString('base64');
    return { password, timestamp };
  }

  async initiateStkPush(params: {
    phoneNumber: string; // format: 2547XXXXXXXX
    amount: number; // in KES, integer
    accountRef: string; // e.g. invoice number
    description: string;
  }): Promise<StkPushResponse> {
    const token = await this.getAccessToken();
    const { password, timestamp } = this.buildPassword();

    const body = {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(params.amount), // Daraja requires integer
      PartyA: params.phoneNumber,
      PartyB: this.config.shortcode,
      PhoneNumber: params.phoneNumber,
      CallBackURL: this.config.callbackUrl,
      AccountReference: params.accountRef,
      TransactionDesc: params.description,
    };

    const res = await fetch(
      `${this.config.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`STK push failed: ${res.status} — ${text}`);
      throw new ServiceUnavailableException('Failed to initiate payment');
    }

    const data = (await res.json()) as StkPushResponse;

    if (data.ResponseCode !== '0') {
      this.logger.error(`STK push rejected: ${data.ResponseDescription}`);
      throw new ServiceUnavailableException(
        data.ResponseDescription || 'Payment initiation rejected',
      );
    }

    this.logger.log(
      `STK push initiated — CheckoutRequestID: ${data.CheckoutRequestID}`,
    );
    return data;
  }

  /** Extracts the M-Pesa receipt number from a successful callback */
  extractReceiptNumber(callback: StkCallbackBody): string | null {
    const items = callback.Body.stkCallback.CallbackMetadata?.Item ?? [];
    const item = items.find((i) => i.Name === 'MpesaReceiptNumber');
    return item?.Value ? String(item.Value) : null;
  }
}
