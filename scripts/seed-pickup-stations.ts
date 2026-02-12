/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import path from 'path';
import fs from 'fs';
import prisma from './prisma-instance';

declare const __dirname: string;

interface PickupStationSeed {
  code: string;
  name: string;
  country?: string;
  postalCode?: string | null;

  address1: string;
  address2?: string | null;
  landmark?: string | null;

  level1: string;
  level2?: string | null;
  level3?: string | null;
  level4?: string | null;
  level5?: string | null;

  coordinates?: { lat: number; lng: number } | null;

  phoneNumber?: string | null;
  email?: string | null;

  operatingHours: object | string;
  voided?: boolean;
  addressLocaleCode: string;
}

async function seedPickupStations(): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'pickup-stations.json',
  );

  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/pickup-stations.json seed file');
  }

  const payload: PickupStationSeed[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`📍 Seeding ${payload.length} pickup stations...`);

  for (const station of payload) {
    const operatingHours =
      typeof station.operatingHours === 'string'
        ? JSON.parse(station.operatingHours)
        : station.operatingHours;

    const coordinates =
      typeof station.coordinates === 'string'
        ? JSON.parse(station.coordinates)
        : (station.coordinates ?? null);

    await prisma.pickupStation.upsert({
      where: { code: station.code },
      update: {
        name: station.name,
        country: station.country ?? 'KE',
        postalCode: station.postalCode ?? null,
        address1: station.address1,
        address2: station.address2 ?? null,
        landmark: station.landmark ?? null,
        level1: station.level1,
        level2: station.level2 ?? null,
        level3: station.level3 ?? null,
        level4: station.level4 ?? null,
        level5: station.level5 ?? null,
        coordinates: coordinates,
        phoneNumber: station.phoneNumber ?? null,
        email: station.email ?? null,
        operatingHours,
        voided: station.voided ?? false,

        // 🔥 important
        addressLocale: {
          connect: { code: station.addressLocaleCode },
        },
      },
      create: {
        code: station.code,
        name: station.name,
        country: station.country ?? 'KE',
        postalCode: station.postalCode ?? null,
        address1: station.address1,
        address2: station.address2 ?? null,
        landmark: station.landmark ?? null,
        level1: station.level1,
        level2: station.level2 ?? null,
        level3: station.level3 ?? null,
        level4: station.level4 ?? null,
        level5: station.level5 ?? null,
        coordinates,
        phoneNumber: station.phoneNumber ?? null,
        email: station.email ?? null,
        operatingHours,
        voided: station.voided ?? false,

        // 🔥 required relation
        addressLocale: {
          connect: { code: station.addressLocaleCode },
        },
      },
    });

    console.log(`✅ Upserted pickup station: ${station.code}`);
  }

  console.log('🎉 Pickup stations seed completed!');
}

seedPickupStations()
  .catch((err) => {
    console.error('Failed seeding pickup stations', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
