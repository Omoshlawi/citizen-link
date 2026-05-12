import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { lastValueFrom } from 'rxjs';
import { DarajaConfig } from './daraja.config';
import {
  B2CResponseDto,
  DarajaTokenResponseDto,
  StkCallbackBodyDto,
  StkPushResponseDto,
} from './daraja.dto';

@Injectable()
export class DarajaService {
  private readonly logger = new Logger(DarajaService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: DarajaConfig,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`,
    ).toString('base64');

    try {
      const res = await lastValueFrom(
        this.httpService.get<DarajaTokenResponseDto>(
          '/oauth/v1/generate?grant_type=client_credentials',
          { headers: { Authorization: `Basic ${credentials}` } },
        ),
      );
      this.cachedToken = res.data.access_token;
      // expire 60s before actual expiry to avoid edge-case stale tokens
      this.tokenExpiresAt =
        Date.now() + (Number(res.data.expires_in) - 60) * 1000;
      return this.cachedToken;
    } catch (error) {
      this.logger.error(
        `Daraja OAuth failed: ${isAxiosError(error) ? error.response?.status : String(error)}`,
      );
      throw new ServiceUnavailableException('Payment provider unavailable');
    }
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
  }): Promise<StkPushResponseDto> {
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

    let data: StkPushResponseDto;
    try {
      const res = await lastValueFrom(
        this.httpService.post<StkPushResponseDto>(
          '/mpesa/stkpush/v1/processrequest',
          body,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      data = res.data;
    } catch (error) {
      this.logger.error(
        `STK push failed: ${isAxiosError(error) ? `${error.response?.status} — ${JSON.stringify(error.response?.data)}` : String(error)}`,
      );
      throw new ServiceUnavailableException('Failed to initiate payment');
    }

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

  /**
   * Encrypts the B2C initiator password with the Safaricom public certificate.
   * Download the real cert from the Daraja portal and place it at:
   *   assets/certs/daraja-sandbox.cer   (sandbox)
   *   assets/certs/daraja-production.cer (production)
   */
  private buildSecurityCredential(): string {
    const certFile =
      this.config.environment === 'production'
        ? 'daraja-production.cer'
        : 'daraja-sandbox.cer';
    const certPath = path.resolve(
      __dirname,
      '..',
      '..',
      'assets',
      'certs',
      certFile,
    );
    const cert = fs.readFileSync(certPath, 'utf8');
    const encrypted = crypto.publicEncrypt(
      { key: cert, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(this.config.b2cInitiatorPassword),
    );
    return encrypted.toString('base64');
  }

  /**
   * Initiates a Daraja B2C (Business-to-Customer) payment — used to disburse
   * finder rewards directly to the finder's M-Pesa account.
   */
  async initiateB2CPayout(params: {
    phoneNumber: string; // 2547XXXXXXXX
    amount: number; // in KES, integer
    reference: string; // disbursement number shown in M-Pesa message
    remarks: string;
  }): Promise<B2CResponseDto> {
    const token = await this.getAccessToken();
    const securityCredential = this.buildSecurityCredential();

    const body = {
      InitiatorName: this.config.b2cInitiatorName,
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayment',
      Amount: Math.ceil(params.amount),
      PartyA: this.config.shortcode,
      PartyB: params.phoneNumber,
      Remarks: params.remarks,
      QueueTimeOutURL: this.config.b2cTimeoutUrl,
      ResultURL: this.config.b2cResultUrl,
      Occassion: params.reference, // Daraja typo in spec — keep as-is
    };

    let data: B2CResponseDto;
    try {
      const res = await lastValueFrom(
        this.httpService.post<B2CResponseDto>(
          '/mpesa/b2c/v3/paymentrequest',
          body,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      data = res.data;
    } catch (error) {
      this.logger.error(
        `B2C payout failed: ${isAxiosError(error) ? `${error.response?.status} — ${JSON.stringify(error.response?.data)}` : String(error)}`,
      );
      throw new ServiceUnavailableException('Failed to initiate payout');
    }

    if (data.ResponseCode !== '0') {
      this.logger.error(`B2C payout rejected: ${data.ResponseDescription}`);
      throw new ServiceUnavailableException(
        data.ResponseDescription || 'Payout initiation rejected',
      );
    }

    this.logger.log(
      `B2C payout initiated — ConversationID: ${data.ConversationID}`,
    );
    return data;
  }

  /** Extracts the M-Pesa receipt number from a successful callback */
  extractReceiptNumber(callback: StkCallbackBodyDto): string | null {
    const items = callback.Body.stkCallback.CallbackMetadata?.Item ?? [];
    const item = items.find((i) => i.Name === 'MpesaReceiptNumber');
    return item?.Value ? String(item.Value) : null;
  }
}
