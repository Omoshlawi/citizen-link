const path = require('path');
const fs = require('fs');
const prisma = require('./prisma-instance');

async function seedDocumentTypes() {
  const filePath = path.resolve(__dirname, '..', 'assets', 'document-types.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing assets/document-types.json seed file');
  }

  const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`📄 Seeding ${payload.length} document types...`);
  for (const docType of payload) {
    await prisma.documentType.upsert({
      where: { name: docType.name },
      update: {
        category: docType.category,
        description: docType.description,
        icon: docType.icon,
        loyaltyPoints: docType.loyaltyPoints,
        replacementInstructions: docType.replacementInstructions,
        averageReplacementCost: docType.averageReplacementCost,
        verificationStrategy: docType.verificationStrategy,
        aiExtractionPrompt: docType.aiExtractionPrompt || null,
        voided: false,
      },
      create: {
        name: docType.name,
        category: docType.category,
        description: docType.description,
        icon: docType.icon,
        loyaltyPoints: docType.loyaltyPoints,
        replacementInstructions: docType.replacementInstructions,
        averageReplacementCost: docType.averageReplacementCost,
        verificationStrategy: docType.verificationStrategy,
        aiExtractionPrompt: docType.aiExtractionPrompt || null,
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
