/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import path from 'path';
import fs from 'fs';
import prisma from './prisma-instance';

declare const __dirname: string;

interface DocumentOperationConfigSeed {
  code: string;
  prefix: string;
  name: string;
  description?: string;
  requiresDestinationStation: boolean;
  requiresSourceStation: boolean;
  requiresNotes: boolean;
  isHighPrivilege: boolean;
  isFinalOperation: boolean;
}

async function seedDocumentOperations(): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'json',
    'document-operation-configs.json',
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(
      'Missing assets/json/document-operation-configs.json seed file',
    );
  }

  const configs: DocumentOperationConfigSeed[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`🔧 Seeding ${configs.length} document operation types...`);

  // 1. Upsert operation types by code
  for (const config of configs) {
    await prisma.documentOperationType.upsert({
      where: { code: config.code },
      update: {
        prefix: config.prefix,
        name: config.name,
        description: config.description,
        requiresDestinationStation: config.requiresDestinationStation,
        requiresSourceStation: config.requiresSourceStation,
        requiresNotes: config.requiresNotes,
        isHighPrivilege: config.isHighPrivilege,
        isFinalOperation: config.isFinalOperation,
      },
      create: {
        code: config.code,
        prefix: config.prefix,
        name: config.name,
        description: config.description,
        requiresDestinationStation: config.requiresDestinationStation,
        requiresSourceStation: config.requiresSourceStation,
        requiresNotes: config.requiresNotes,
        isHighPrivilege: config.isHighPrivilege,
        isFinalOperation: config.isFinalOperation,
      },
    });

    console.log(
      `  ✅ Upserted operation type: ${config.code} (${config.prefix})`,
    );
  }

  // 2. Seed StationOperationType rows: every station × every operation type
  //    DISPOSAL is disabled by default everywhere (isHighPrivilege guard)
  const stations = await prisma.pickupStation.findMany({
    where: { voided: false },
    select: { id: true, code: true },
  });

  const operationTypes = await prisma.documentOperationType.findMany({
    where: { voided: false },
    select: { id: true, code: true, isHighPrivilege: true },
  });

  console.log(
    `\n🏬 Seeding station operation types for ${stations.length} stations × ${operationTypes.length} operation types...`,
  );

  for (const station of stations) {
    for (const opType of operationTypes) {
      // DISPOSAL and any high-privilege ops disabled by default at all stations
      const isEnabled = !opType.isHighPrivilege;

      await prisma.stationOperationType.upsert({
        where: {
          stationId_operationTypeId: {
            stationId: station.id,
            operationTypeId: opType.id,
          },
        },
        update: {},
        create: {
          stationId: station.id,
          operationTypeId: opType.id,
          isEnabled,
        },
      });
    }
    console.log(
      `  ✅ Station ${station.code}: ${operationTypes.length} operation types configured`,
    );
  }

  console.log('\n🎉 Document operation seed completed!');
}

seedDocumentOperations()
  .catch((err) => {
    console.error('Failed seeding document operations', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
