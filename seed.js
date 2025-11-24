require('dotenv').config();

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

async function seed() {
  try {
    console.log('🌍 Seeding Kenya Address Hierarchy...');
    const COUNTRY_CODE = 'KE';
    const counties = require('./assets/kenyan-counties-subcounties-wards.json');

    for (const county of counties) {
      const countyCode = `${COUNTRY_CODE}-${county.code}`;

      // Level 1: County
      const countyRecord = await prisma.addressHierarchy.upsert({
        where: { country_code: { country: COUNTRY_CODE, code: countyCode } },
        update: { name: county.name },
        create: {
          country: COUNTRY_CODE,
          level: 1,
          code: countyCode,
          name: county.name,
        },
      });

      // Level 2: Subcounties
      if (county.subCounties?.length) {
        for (const sub of county.subCounties) {
          const subCode = `${countyCode}-${sub.code}`;

          const subRecord = await prisma.addressHierarchy.upsert({
            where: { country_code: { country: COUNTRY_CODE, code: subCode } },
            update: { name: sub.name, parentId: countyRecord.id },
            create: {
              country: COUNTRY_CODE,
              level: 2,
              parentId: countyRecord.id,
              code: subCode,
              name: sub.name,
            },
          });

          // Level 3: Wards
          if (sub.wards?.length) {
            for (const ward of sub.wards) {
              const wardCode = `${subCode}-${ward.code}`;

              await prisma.addressHierarchy.upsert({
                where: {
                  country_code: { country: COUNTRY_CODE, code: wardCode },
                },
                update: { name: ward.name, parentId: subRecord.id },
                create: {
                  country: COUNTRY_CODE,
                  level: 3,
                  parentId: subRecord.id,
                  code: wardCode,
                  name: ward.name,
                },
              });
            }
          }
        }
      }

      console.log(`✅ Seeded County: ${county.name}`);
    }

    console.log('🎉 Kenya Address Hierarchy Seed Completed!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
