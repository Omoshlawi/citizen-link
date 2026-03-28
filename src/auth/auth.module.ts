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
  twoFactor,
  phoneNumber,
} from 'better-auth/plugins';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
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
        notificationDispatch: NotificationDispatchService,
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
            user: {
              changeEmail: {
                enabled: true,
                async sendChangeEmailVerification(
                  { user, newEmail, token },
                  _,
                ) {
                  const deepLink = `citizenlinkapp://change-email-verify?token=${token}`;
                  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/change-email-verify?token=${token}`;
                  const year = new Date().getFullYear();
                  // 1. Verification email → new address (proves ownership)
                  await notificationDispatch.sendFromTemplate({
                    templateKey: 'auth.email.change',
                    recipient: { email: newEmail },
                    data: { user, newEmail, deepLink, verificationUrl, year },
                    userId: user.id,
                    priority: NotificationPriority.HIGH,
                    force: true,
                    eventTitle: 'Email Change Requested',
                    eventBody: `A verification email has been sent to ${newEmail} to confirm the email address change.`,
                    eventDescription: `Email change requested by user ${user.email} (id: ${user.id}) to new address ${newEmail}.`,
                  });
                  // 2. Security alert → old address (notifies the account owner)
                  await notificationDispatch.sendFromTemplate({
                    templateKey: 'auth.email.change.alert',
                    recipient: { email: user.email },
                    data: { user, newEmail, year },
                    userId: user.id,
                    priority: NotificationPriority.HIGH,
                    force: true,
                    eventTitle: 'Email Change Security Alert',
                    eventBody: `A security notice has been sent to ${user.email} regarding the email address change request.`,
                    eventDescription: `Security alert sent to old address ${user.email} for email change to ${newEmail} (user id: ${user.id}).`,
                  });
                },
              },
            },
            plugins: [
              username(),
              admin(adminConfig),
              bearer(),
              openAPI(),
              jwt(),
              twoFactor({
                otpOptions: {
                  sendOTP({ user, otp }, request) {
                    // console.log('Data ---------', user);
                    console.log('OTP ---------', otp);
                    // console.log('Request ---------', request);
                  },
                },
              }),
              phoneNumber({
                sendOTP: ({ phoneNumber, code }, ctx) => {
                  console.log('Phone Number ---------', phoneNumber);
                  console.log('Code ---------', code);
                },
                // Optional: Auto-create user on verification
                signUpOnVerification: {
                  getTempEmail(phoneNumber) {
                    return `${phoneNumber}@citizenlink.app`;
                  },
                  getTempName(phoneNumber) {
                    return `${phoneNumber}@citizenlink.app`;
                  },
                },
              }),
            ],
            advanced: { disableOriginCheck: true },
            hooks,
            emailAndPassword: {
              enabled: true,
              async sendResetPassword({ user, token }, _) {
                const deepLink = `citizenlinkapp://auth/reset-password?token=${token}`;
                const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
                await notificationDispatch.sendFromTemplate({
                  templateKey: 'auth.password.reset',
                  recipient: { email: user.email },
                  data: {
                    user,
                    deepLink,
                    resetUrl,
                    year: new Date().getFullYear(),
                  },
                  userId: user.id,
                  priority: NotificationPriority.HIGH,
                  force: true,
                  eventTitle: 'Password Reset Requested',
                  eventBody: `A password reset email has been sent to ${user.email}.`,
                  eventDescription: `Password reset requested for user ${user.email} (id: ${user.id}).`,
                });
              },
              requireEmailVerification: true,
            },
            emailVerification: {
              async sendVerificationEmail({ user, token, url }, _) {
                const deepLink = `citizenlinkapp://auth/verify-email?token=${token}`;
                await notificationDispatch.sendFromTemplate({
                  templateKey: 'auth.email.verification',
                  recipient: { email: user.email },
                  data: {
                    user,
                    deepLink,
                    verificationUrl: url,
                    year: new Date().getFullYear(),
                  },
                  userId: user.id,
                  priority: NotificationPriority.HIGH,
                  force: true,
                  eventTitle: 'Verify Your Email',
                  eventBody: `A verification email has been sent to ${user.email}. Please verify your email address to activate your account.`,
                  eventDescription: `Email verification triggered for new user ${user.email} (id: ${user.id}) on sign-up.`,
                });
              },
              autoSignInAfterVerification: true,
              sendOnSignUp: true,
              sendOnSignIn: true,
            },
          }),
        };
      },
      inject: [
        PrismaService,
        DiscoveryService,
        Reflector,
        MetadataScanner,
        NotificationDispatchService,
      ],
    });
  }
}
