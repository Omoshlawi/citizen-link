import { Injectable } from '@nestjs/common';
import z from 'zod';
import { SystemSettingService } from '../common/settings/settings.system.service';
import { RegionService } from '../region/region.service';
import { DELIVERY_FEE_KEYS, DeliveryZone } from './delivery-zone.util';

export interface DeliveryZoneFee {
  zone: DeliveryZone;
  amount: number;
  currency: string;
}

export interface DeliveryPolicy {
  maxAttempts: number;
  feeNonRefundable: boolean;
  retryFreeUntilAttempt: number;
  fallbackMethod: 'OWNER_PICKUP';
  fees: DeliveryZoneFee[];
}

@Injectable()
export class DocumentExchangePolicyService {
  constructor(
    private readonly settings: SystemSettingService,
    private readonly region: RegionService,
  ) {}

  async getPolicy(): Promise<DeliveryPolicy> {
    const currency = this.region.getCurrency();
    const [maxAttempts, localFee, countyFee, nationalFee] = await Promise.all([
      this.settings.get('delivery.max_attempts', z.coerce.number(), 2),
      this.settings.get(
        DELIVERY_FEE_KEYS[DeliveryZone.LOCAL],
        z.coerce.number(),
        200,
      ),
      this.settings.get(
        DELIVERY_FEE_KEYS[DeliveryZone.COUNTY],
        z.coerce.number(),
        450,
      ),
      this.settings.get(
        DELIVERY_FEE_KEYS[DeliveryZone.NATIONAL],
        z.coerce.number(),
        900,
      ),
    ]);

    return {
      maxAttempts,
      feeNonRefundable: true,
      retryFreeUntilAttempt: maxAttempts - 1,
      fallbackMethod: 'OWNER_PICKUP',
      fees: [
        { zone: DeliveryZone.LOCAL, amount: localFee, currency },
        { zone: DeliveryZone.COUNTY, amount: countyFee, currency },
        { zone: DeliveryZone.NATIONAL, amount: nationalFee, currency },
      ],
    };
  }

  async getMaxAttempts(): Promise<number> {
    return this.settings.get('delivery.max_attempts', z.coerce.number(), 2);
  }

  async getFeeForZone(zone: DeliveryZone): Promise<number> {
    const defaults: Record<DeliveryZone, number> = {
      [DeliveryZone.LOCAL]: 200,
      [DeliveryZone.COUNTY]: 450,
      [DeliveryZone.NATIONAL]: 900,
    };
    return this.settings.get(
      DELIVERY_FEE_KEYS[zone],
      z.coerce.number(),
      defaults[zone],
    );
  }
}
