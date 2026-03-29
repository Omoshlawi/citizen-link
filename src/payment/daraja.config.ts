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

  /** Publicly reachable URL Daraja will POST callbacks to */
  @Value('DARAJA_CALLBACK_URL')
  callbackUrl: string;

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
