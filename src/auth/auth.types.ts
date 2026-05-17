import { UserSession as BetterAuthUserSession } from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import {
  admin,
  bearer,
  jwt,
  openAPI,
  phoneNumber,
  twoFactor,
  username,
} from 'better-auth/plugins';
import { adminConfig } from './auth.contants';

export type BetterAuthWithPlugins = ReturnType<
  typeof betterAuth<{
    plugins: [
      ReturnType<typeof username>,
      ReturnType<typeof admin<typeof adminConfig>>,
      ReturnType<typeof bearer>,
      ReturnType<typeof openAPI>,
      ReturnType<typeof jwt>,
      ReturnType<typeof twoFactor>,
      ReturnType<typeof phoneNumber>,
    ];
  }>
>;

export interface UserSession extends BetterAuthUserSession {
  user: BetterAuthUserSession['user'] & {
    isAnonymous?: boolean;
    phoneNumber?: string | null;
    phoneNumberVerified?: boolean;
  };
  session: BetterAuthUserSession['session'] & {
    activeOrganizationId?: string;
    impersonatedBy?: string;
    stationId?: string | null;
  };
}
