/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import path from 'path';
import fs from 'fs';
import prisma from './prisma-instance';

declare const __dirname: string;

interface SystemSettingSeed {
  key: string;
  value: string;
  description?: string;
  isPublic: boolean;
}

async function seedSystemSettings(): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'json',
    'system-settings.json',
  );

  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/json/system-settings.json');
  }

  const settings: SystemSettingSeed[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`🔧 Seeding ${settings.length} system settings...`);

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key_userId: { key: setting.key, userId: '*' } },
      update: {},
      create: {
        key: setting.key,
        userId: '*',
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
      },
    });
    console.log(`  ✓ ${setting.key} = ${setting.value}`);
  }
}

seedSystemSettings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
