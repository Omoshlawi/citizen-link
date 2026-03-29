/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class DarajaConfig {
  @Value('DARAJA_CONSUMER_KEY')
  consumerKey: string;

  @Value('DARAJA_CONSUMER_SECRET')
  consumerSecret: string;

  /** Lipa na M-Pesa paybill / till number */
  @Value('DARAJA_SHORTCODE')
  shortcode: string;

  /** Lipa na M-Pesa Online passkey (from Daraja portal) */
  @Value('DARAJA_PASSKEY')
  passkey: string;

  /** Publicly reachable URL Daraja will POST STK push callbacks to */
  @Value('DARAJA_CALLBACK_URL')
  callbackUrl: string;

  // ── B2C (Business-to-Customer) ─────────────────────────────────────────────

  /** Daraja API operator username (e.g. "testapi" in sandbox) */
  @Value('DARAJA_B2C_INITIATOR_NAME')
  b2cInitiatorName: string;

  /**
   * Plain-text initiator password — encrypted at call time with the Safaricom
   * public cert (assets/certs/daraja-{sandbox|production}.cer).
   */
  @Value('DARAJA_B2C_INITIATOR_PASSWORD')
  b2cInitiatorPassword: string;

  /** Publicly reachable URL Daraja will POST B2C result callbacks to */
  @Value('DARAJA_B2C_RESULT_URL')
  b2cResultUrl: string;

  /** Publicly reachable URL Daraja will POST B2C timeout callbacks to */
  @Value('DARAJA_B2C_TIMEOUT_URL')
  b2cTimeoutUrl: string;

  @Value('DARAJA_ENV', {
    default: 'sandbox',
    parse: z.enum(['sandbox', 'production']).parse,
  })
  environment: 'sandbox' | 'production';

  get baseUrl(): string {
    return this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }
}
