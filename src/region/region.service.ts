import { Injectable } from '@nestjs/common';
import { RegionConfig } from './region.config';

@Injectable()
export class RegionService {
  constructor(private readonly regionConfig: RegionConfig) {}

  getCurrency(): string {
    return this.regionConfig.currency;
  }

  getLocale(): string {
    return this.regionConfig.locale;
  }

  getTimezone(): string {
    return this.regionConfig.timezone;
  }

  getCountryCode(): string {
    return this.regionConfig.countryCode;
  }

  getCountryName(): string {
    return this.regionConfig.countryName;
  }

  getAddressLocaleCode(): string {
    return this.regionConfig.addressLocaleCode;
  }

  getLanguages(): string[] {
    return this.regionConfig.languages;
  }

  getMapDefault(): { lat: number; lng: number } {
    return {
      lat: this.regionConfig.mapDefaultLat,
      lng: this.regionConfig.mapDefaultLng,
    };
  }

  getPhoneRegex(): RegExp {
    return this.regionConfig.phoneRegex;
  }

  getPhoneRegexRaw(): string {
    return this.regionConfig.phoneRegexRaw;
  }

  getCallingCode(): string {
    return this.regionConfig.callingCode;
  }

  getPaymentProviders(): string[] {
    return this.regionConfig.paymentProviders;
  }

  getAppName(): string {
    return this.regionConfig.appName;
  }

  getSubscriberRegexRaw(): string {
    return this.regionConfig.subscriberRegexRaw;
  }

  getSubscriberRegex(): RegExp {
    return this.regionConfig.subscriberRegex;
  }

  getSubscriberExample(): string {
    return this.regionConfig.subscriberExample;
  }

  /**
   * Normalises any phone format to E.164 (e.g. +254712345678).
   * Handles: E.164, local-with-0, already-stripped, subscriber-only.
   */
  toE164(phone: string): string {
    const callingDigits = this.regionConfig.callingCode.replace(/^\+/, '');
    const cleaned = phone.replace(/\s/g, '');

    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('0')) return `+${callingDigits}${cleaned.slice(1)}`;
    if (cleaned.startsWith(callingDigits)) return `+${cleaned}`;
    // Subscriber-only (e.g. 712345678)
    return `+${callingDigits}${cleaned}`;
  }

  /**
   * Normalises any phone format to Daraja format: digits only, country code
   * first, no leading + (e.g. 254712345678).
   * Daraja rejects E.164 with the leading plus sign.
   */
  toDarajaPhone(phone: string): string {
    return this.toE164(phone).slice(1); // strip the leading '+'
  }

  /** Shape returned by GET /api/config/public — consumed by mobile/web clients. */
  getPublicConfig() {
    return {
      countryCode: this.regionConfig.countryCode,
      countryName: this.regionConfig.countryName,
      currency: this.regionConfig.currency,
      locale: this.regionConfig.locale,
      timezone: this.regionConfig.timezone,
      addressLocaleCode: this.regionConfig.addressLocaleCode,
      languages: this.regionConfig.languages,
      mapDefault: this.getMapDefault(),
      phoneRegex: this.regionConfig.phoneRegexRaw,
      subscriberRegex: this.regionConfig.subscriberRegexRaw,
      subscriberExample: this.regionConfig.subscriberExample,
      callingCode: this.regionConfig.callingCode,
      paymentProviders: this.regionConfig.paymentProviders,
      appName: this.regionConfig.appName,
    };
  }
}
