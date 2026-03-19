import path from 'path';
import fs from 'fs';
import prisma from './prisma-instance';
import { zip } from 'lodash';

declare const __dirname: string;

interface TemplateFileSlot {
  source: 'file';
  path: string;
}

interface TemplateTextSlot {
  source: 'text';
  text: string;
}

interface TemplateSeed {
  key: string;
  type: string;
  name: string;
  description?: string;
  engine?: string;
  slots: Record<string, TemplateFileSlot | TemplateTextSlot>;
  schema: Record<'required' | 'optional', string[]>;
  metadata: Record<string, any>;
}

const getTemplateAbsolutePath = (file: string) => {
  return path.resolve(__dirname, '..', 'assets', 'templates', file);
};

async function seedTemplates(): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'json',
    'templates.json', // your JSON seed
  );

  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/json/templates.json seed file');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const payload: TemplateSeed[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`🌐 Seeding ${payload.length} templates...`);

  for (const template of payload) {
    const slot_keys = Object.keys(template.slots);
    const slotsValues = slot_keys.map((key) => {
      const slot = template.slots[key];
      if (slot.source === 'file') {
        const path = getTemplateAbsolutePath(slot.path);
        if (!fs.existsSync(path)) {
          throw new Error(`Missing template file: ${path}`);
        }
        return fs.readFileSync(path, 'utf-8');
      } else {
        return slot.text;
      }
    });
    const slots = Object.fromEntries(zip(slot_keys, slotsValues)) as Record<
      string,
      any
    >;

    await prisma.template.upsert({
      where: {
        key: template.key,
      },
      update: {
        name: template.name,
        description: template.description,
        slots,
        schema: template.schema,
        metadata: template.metadata,
        engine: template.engine,
        type: template.type,
        version: 1,
      },
      create: {
        key: template.key,
        type: template.type,
        name: template.name,
        description: template.description,
        slots,
        schema: template.schema,
        metadata: template.metadata,
        engine: template.engine,
        version: 1,
      },
    });

    console.log(`✅ Upserted template ${template.key}`);
  }

  console.log('🎉 Templates seed completed!');
}

seedTemplates()
  .catch((err) => {
    console.error('Failed seeding templates', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
