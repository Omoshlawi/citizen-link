/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DynamicModule } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  AFTER_HOOK_KEY,
  AuthModule as AuthenticationModule,
  BEFORE_HOOK_KEY,
  HOOK_KEY,
} from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
  admin,
  bearer,
  createAuthMiddleware,
  jwt,
  openAPI,
  username,
} from 'better-auth/plugins';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { adminConfig } from './auth.contants';
import { AuthExtendedController } from './auth.controller';
import { AuthHookHook } from './auth.hooks';

const HOOKS = [
  { metadataKey: BEFORE_HOOK_KEY, hookType: 'before' as const },
  { metadataKey: AFTER_HOOK_KEY, hookType: 'after' as const },
];

export class AuthModule {
  static forRoot(): DynamicModule {
    const authModule = this.getAuthModule();
    return {
      module: AuthModule,
      global: true,
      imports: [authModule, PrismaModule],
      exports: [authModule],
      controllers: [AuthExtendedController],
      providers: [AuthHookHook],
    };
  }

  private static getAuthModule() {
    return AuthenticationModule.forRootAsync({
      imports: [PrismaModule],
      useFactory(
        prisma: PrismaService,
        discover: DiscoveryService,
        reflector: Reflector,
        metadataScanner: MetadataScanner,
      ) {
        const providers = discover
          .getProviders()
          .filter(
            ({ metatype }) => metatype && reflector.get(HOOK_KEY, metatype),
          );
        const hooks = {};

        for (const provider of providers) {
          const providerPrototype = Object.getPrototypeOf(provider.instance);
          const methods = metadataScanner.getAllMethodNames(providerPrototype);
          for (const method of methods) {
            const providerMethod = providerPrototype[method];
            for (const { metadataKey, hookType } of HOOKS) {
              const hookPath = reflector.get(metadataKey, providerMethod);
              if (!hookPath) continue;

              const originalHook = hooks[hookType];
              hooks[hookType] = createAuthMiddleware(async (ctx) => {
                if (originalHook) {
                  await originalHook(ctx);
                }

                if (hookPath === ctx.path) {
                  await providerMethod.apply(provider.instance, [ctx]);
                }
              });
            }
          }
        }
        return {
          auth: betterAuth({
            database: prismaAdapter(prisma, {
              provider: 'postgresql',
            }),
            plugins: [
              username(),
              admin(adminConfig),
              bearer(),
              openAPI(),
              jwt(),
            ],
            advanced: { disableOriginCheck: true },
            hooks,
            emailAndPassword: {
              enabled: true,
              // eslint-disable-next-line @typescript-eslint/require-await
              async sendResetPassword({ token }, _) {
                // http://localhost:8090/api/auth/reset-password/4IlzTEQRdCSm4B1fy4YqrVUF?callbackURL=%2Freset-password
                console.log('Token ---------', token);
                console.log('Url ---------', `/reset-password?token=${token}`);
              },
              requireEmailVerification: false,
            },
            emailVerification: {
              // eslint-disable-next-line @typescript-eslint/require-await
              async sendVerificationEmail({ token, url }, _) {
                console.log('Token ---------', token);
                console.log('URL ---------', url);
                console.log('Url ---------', `/verify-email?token=${token}`);
              },
              autoSignInAfterVerification: true,
              sendOnSignUp: true,
            },
          }),
        };
      },
      inject: [PrismaService, DiscoveryService, Reflector, MetadataScanner],
    });
  }
}
