/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class RegionConfig {
  @Value('REGION_COUNTRY_CODE', { default: 'KE' })
  countryCode: string;

  @Value('REGION_COUNTRY_NAME', { default: 'Kenya' })
  countryName: string;

  /** ISO 4217 currency code (e.g. KES, TZS, UGX) */
  @Value('REGION_CURRENCY', { default: 'KES' })
  currency: string;

  /** BCP 47 locale used for Intl.* date/time/number formatting (e.g. en-KE, en-TZ) */
  @Value('REGION_LOCALE', { default: 'en-KE' })
  locale: string;

  /** IANA timezone (e.g. Africa/Nairobi) */
  @Value('REGION_TIMEZONE', { default: 'Africa/Nairobi' })
  timezone: string;

  /** Must match an AddressLocale.code seeded in the database */
  @Value('REGION_ADDRESS_LOCALE_CODE', { default: 'ke-default' })
  addressLocaleCode: string;

  /** Comma-separated BCP 47 language codes (e.g. en,sw) */
  @Value('REGION_LANGUAGES', { default: 'en,sw' })
  languagesRaw: string;

  get languages(): string[] {
    return this.languagesRaw.split(',').map((l) => l.trim());
  }

  @Value('REGION_MAP_LAT', {
    default: -1.2921,
    parse: z.coerce.number().optional().parse,
  })
  mapDefaultLat: number;

  @Value('REGION_MAP_LNG', {
    default: 36.8219,
    parse: z.coerce.number().optional().parse,
  })
  mapDefaultLng: number;

  /**
   * Phone number regex pattern as a plain string without surrounding slashes.
   * Compiled to RegExp on demand via the phoneRegex getter.
   * Also sent to mobile clients via GET /api/config/public.
   */
  @Value('REGION_PHONE_REGEX', {
    default: '^(\\+?254|0)((7|1)\\d{8})$',
  })
  phoneRegexRaw: string;

  get phoneRegex(): RegExp {
    return new RegExp(this.phoneRegexRaw);
  }

  /** E.164 country calling code prefix (e.g. +254, +255, +256) */
  @Value('REGION_CALLING_CODE', { default: '+254' })
  callingCode: string;

  /** Comma-separated logical payment provider names (e.g. mpesa, tigopesa, mtn_momo) */
  @Value('REGION_PAYMENT_PROVIDERS', { default: 'mpesa' })
  paymentProvidersRaw: string;

  get paymentProviders(): string[] {
    return this.paymentProvidersRaw.split(',').map((p) => p.trim());
  }

  /** Brand/display name for this deployment (e.g. CitizenLink Kenya) */
  @Value('REGION_APP_NAME', { default: 'CitizenLink Kenya' })
  appName: string;
}
