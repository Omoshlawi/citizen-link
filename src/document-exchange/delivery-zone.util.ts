export enum DeliveryZone {
  LOCAL = 'LOCAL',
  COUNTY = 'COUNTY',
  NATIONAL = 'NATIONAL',
}

export const DELIVERY_FEE_KEYS: Record<DeliveryZone, string> = {
  [DeliveryZone.LOCAL]: 'delivery.fee.local',
  [DeliveryZone.COUNTY]: 'delivery.fee.county',
  [DeliveryZone.NATIONAL]: 'delivery.fee.national',
};

/**
 * Compares station and delivery address administrative levels to determine
 * the delivery zone for flat-fee pricing.
 *
 * Same level2 (sub-county)  → LOCAL
 * Same level1 (county)      → COUNTY
 * Different level1           → NATIONAL
 */
export function resolveDeliveryZone(
  stationLevel1: string,
  stationLevel2: string | null | undefined,
  addressLevel1: string,
  addressLevel2: string | null | undefined,
): DeliveryZone {
  if (stationLevel2 && addressLevel2 && stationLevel2 === addressLevel2) {
    return DeliveryZone.LOCAL;
  }
  if (stationLevel1 === addressLevel1) {
    return DeliveryZone.COUNTY;
  }
  return DeliveryZone.NATIONAL;
}
