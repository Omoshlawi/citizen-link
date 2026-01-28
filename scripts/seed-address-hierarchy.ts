/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import prisma from './prisma-instance';

interface County {
  code: string;
  name: string;
  subCounties?: SubCounty[];
}

interface SubCounty {
  code: string;
  name: string;
  wards?: Ward[];
}

interface Ward {
  code: string;
  name: string;
}

async function seedAddressHierarchy(): Promise<void> {
  try {
    console.log('🌍 Seeding Kenya Address Hierarchy...');
    const COUNTRY_CODE = 'KE';
    const counties: County[] = require('../assets/kenyan-counties-subcounties-wards.json');

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
    console.error('Error seeding address hierarchy:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAddressHierarchy().catch((err) => {
  console.error('Failed seeding address hierarchy', err);
  process.exitCode = 1;
});
