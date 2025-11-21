import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, bearer, jwt, openAPI, username } from 'better-auth/plugins';
import { PrismaClient } from '../../generated/prisma/client';
import { adminConfig } from './auth.contants';
import { BetterAuthWithPlugins } from './auth.types';

const prisma = new PrismaClient();

export const auth: BetterAuthWithPlugins = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  plugins: [username(), admin(adminConfig), bearer(), openAPI(), jwt()],
});
