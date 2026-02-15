import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
  admin,
  bearer,
  jwt,
  openAPI,
  username,
  twoFactor,
  phoneNumber,
} from 'better-auth/plugins';
import { PrismaClient } from '../../generated/prisma/client';
import { adminConfig } from './auth.contants';
import { BetterAuthWithPlugins } from './auth.types';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

export const auth: BetterAuthWithPlugins = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  plugins: [
    username(),
    admin(adminConfig),
    bearer(),
    openAPI(),
    jwt(),
    twoFactor(),
    phoneNumber(),
  ],
  emailAndPassword: {
    enabled: true,
  },
});
