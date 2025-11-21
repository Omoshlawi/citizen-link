import { Reflector } from '@nestjs/core';
import { adminPluginAcl } from './auth.acl';

export const RequireSystemPermission =
  Reflector.createDecorator<
    Partial<Parameters<(typeof adminPluginAcl)['newRole']>[0]>
  >();
