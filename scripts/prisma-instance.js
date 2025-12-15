require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');

function loadPrismaClient() {
  try {
    const { PrismaClient } = require('../dist/generated/prisma/client');
    return PrismaClient;
  } catch (distError) {
    const isMissingDistClient =
      distError?.code === 'MODULE_NOT_FOUND' &&
      distError.message?.includes('../dist/generated/prisma/client');

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

    const { PrismaClient } = require('../generated/prisma/client');
    return PrismaClient;
  }
}

const PrismaClientClass = loadPrismaClient();
const prisma = new PrismaClientClass({adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })});

module.exports = prisma;
