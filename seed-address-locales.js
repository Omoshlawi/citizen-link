require('dotenv').config();
const path = require('path');
const fs = require('fs');

function loadPrismaClient() {
  try {
    const { PrismaClient } = require('./dist/generated/prisma/client');
    return PrismaClient;
  } catch (distError) {
    const isMissingDistClient =
      distError?.code === 'MODULE_NOT_FOUND' &&
      distError.message?.includes('./dist/generated/prisma/client');

    if (!isMissingDistClient) {
      throw distError;
    }

    try {
      require('ts-node/register');
    } catch (tsNodeError) {
      throw new Error(
        'Missing compiled Prisma client. Either run `pnpm build` to generate `dist/generated/prisma`, or install dev dependencies so `ts-node/register` is available.',
        { cause: tsNodeError },
      );
    }

    const { PrismaClient } = require('./generated/prisma/client');
    return PrismaClient;
  }
}

const prisma = new (loadPrismaClient())();

async function seedAddressLocales() {
  const filePath = path.resolve(__dirname, 'assets', 'address-locales.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/address-locales.json seed file');
  }

  const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

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

