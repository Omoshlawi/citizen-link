import path from 'path';
import fs from 'fs';
import prisma from './prisma-instance';

declare const __dirname: string;

interface AddressLocale {
  code: string;
  country: string;
  regionName: string;
  description: string;
  formatSpec: string;
  examples: string[];
  tags?: string[];
}

async function seedAddressLocales(): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'address-locales.json',
  );
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/address-locales.json seed file');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const payload: AddressLocale[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`🌐 Seeding ${payload.length} address locale templates...`);
  for (const locale of payload) {
    await prisma.addressLocale.upsert({
      where: { code: locale.code },
      update: {
        country: locale.country,
        regionName: locale.regionName,
        description: locale.description,
        formatSpec: locale.formatSpec,
        examples: locale.examples,
        tags: locale.tags ?? [],
        voided: false,
      },
      create: {
        code: locale.code,
        country: locale.country,
        regionName: locale.regionName,
        description: locale.description,
        formatSpec: locale.formatSpec,
        examples: locale.examples,
        tags: locale.tags ?? [],
      },
    });

    console.log(`✅ Upserted locale ${locale.code}`);
  }
  console.log('🎉 Address locale seed completed!');
}

seedAddressLocales()
  .catch((err) => {
    console.error('Failed seeding address locales', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
