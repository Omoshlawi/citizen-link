import path from 'path';
import fs from 'fs';
import prisma from './prisma-instance';

declare const __dirname: string;

interface TransitionReasonSeed {
  entityType: string;
  fromStatus: string;
  toStatus: string;
  code: string;
  auto: boolean;
  label: string;
  description?: string;
}

async function seedTransitionReasons(): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'transition-reasons.json', // your JSON seed
  );

  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/transition-reasons.json seed file');
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const payload: TransitionReasonSeed[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`🌐 Seeding ${payload.length} transition reasons...`);

  for (const reason of payload) {
    await prisma.transitionReason.upsert({
      where: {
        // Use the composite key fields to prevent duplicates
        entityType_fromStatus_toStatus_code: {
          entityType: reason.entityType,
          fromStatus: reason.fromStatus,
          toStatus: reason.toStatus,
          code: reason.code,
        },
      },
      update: {
        auto: reason.auto,
        label: reason.label,
        description: reason.description,
      },
      create: {
        entityType: reason.entityType ?? null,
        fromStatus: reason.fromStatus ?? null,
        toStatus: reason.toStatus ?? null,
        code: reason.code,
        auto: reason.auto,
        label: reason.label,
        description: reason.description,
      },
    });

    console.log(
      `✅ Upserted reason ${reason.code} (${reason.entityType ?? 'GLOBAL'})`,
    );
  }

  console.log('🎉 TransitionReason seed completed!');
}

seedTransitionReasons()
  .catch((err) => {
    console.error('Failed seeding transition reasons', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
