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
      callingCode: this.regionConfig.callingCode,
      paymentProviders: this.regionConfig.paymentProviders,
      appName: this.regionConfig.appName,
    };
  }
}
