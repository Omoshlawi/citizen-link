const path = require('path');
const fs = require('fs');
const prisma = require('./prisma-instance');

async function seedAddressLocales() {
  const filePath = path.resolve(__dirname, '..', 'assets', 'address-locales.json');
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
