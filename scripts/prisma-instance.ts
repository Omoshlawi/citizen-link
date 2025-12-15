import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaClient } from '../generated/prisma/client';

function loadPrismaClient(): typeof PrismaClient {
  try {
    const { PrismaClient } = require('../dist/generated/prisma/client');
    return PrismaClient;
  } catch (distError: any) {
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
const prisma = new PrismaClientClass({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
}) as PrismaClient;

export default prisma;
