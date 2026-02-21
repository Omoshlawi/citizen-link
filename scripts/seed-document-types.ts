/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import path from 'path';
import fs from 'fs';
import prisma from './prisma-instance';
import { DocumentCategory } from '../generated/prisma/client';

declare const __dirname: string;

interface DocumentType {
  name: string;
  category: DocumentCategory | string;
  description: string;
  icon: string;
  loyaltyPoints: number;
  serviceFee: number;
  finderReward: number;
  currency: string;
  replacementInstructions: string;
  averageReplacementCost: number;
  verificationStrategy: string | object;
  aiExtractionPrompt?: string | null;
}

async function seedDocumentTypes(): Promise<void> {
  const filePath = path.resolve(
    __dirname,
    '..',
    'assets',
    'document-types.json',
  );
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/document-types.json seed file');
  }

  const payload: DocumentType[] = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`📄 Seeding ${payload.length} document types...`);
  for (const docType of payload) {
    // Ensure category is a valid DocumentCategory enum value
    const category = docType.category as DocumentCategory;
    // Parse verificationStrategy if it's a string (JSON)
    const verificationStrategy =
      typeof docType.verificationStrategy === 'string'
        ? JSON.parse(docType.verificationStrategy)
        : docType.verificationStrategy;

    await prisma.documentType.upsert({
      where: { name: docType.name },
      update: {
        category: category,
        description: docType.description,
        icon: docType.icon,
        loyaltyPoints: docType.loyaltyPoints,
        replacementInstructions: docType.replacementInstructions,
        averageReplacementCost: docType.averageReplacementCost,
        verificationStrategy: verificationStrategy,
        aiExtractionPrompt: docType.aiExtractionPrompt || null,
        voided: false,
        serviceFee: docType.serviceFee,
        finderReward: docType.finderReward,
        currency: docType.currency,
        totalAmount: docType.serviceFee + docType.finderReward,
      },
      create: {
        name: docType.name,
        category: category,
        description: docType.description,
        icon: docType.icon,
        loyaltyPoints: docType.loyaltyPoints,
        replacementInstructions: docType.replacementInstructions,
        averageReplacementCost: docType.averageReplacementCost,
        verificationStrategy: verificationStrategy,
        aiExtractionPrompt: docType.aiExtractionPrompt || null,
        serviceFee: docType.serviceFee,
        finderReward: docType.finderReward,
        currency: docType.currency,
        totalAmount: docType.serviceFee + docType.finderReward,
      },
    });

    console.log(`✅ Upserted document type: ${docType.name}`);
  }
  console.log('🎉 Document types seed completed!');
}

seedDocumentTypes()
  .catch((err) => {
    console.error('Failed seeding document types', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
