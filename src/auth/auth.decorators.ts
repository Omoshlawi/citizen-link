import { Reflector } from '@nestjs/core';
import { adminPluginAcl } from './auth.acl';

export const RequireSystemPermission =
  Reflector.createDecorator<
    Partial<Parameters<(typeof adminPluginAcl)['newRole']>[0]>
  >();

export enum ActiveStationMode {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
  FORBIDDEN = 'FORBIDDEN',
}

export const RequireActiveStation = Reflector.createDecorator<
  ActiveStationMode | undefined
>();
