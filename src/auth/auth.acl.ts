import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  userAc,
  defaultStatements as defaultAdminStatements,
  defaultRoles as adminDefaultRoles,
} from 'better-auth/plugins/admin/access';

export const adminPluginAcl = createAccessControl({
  ...defaultAdminStatements,
  documentType: ['create', 'update', 'delete', 'restore'],
  addressLocale: ['create', 'update', 'delete', 'restore'],
  pickupStation: ['create', 'update', 'delete', 'restore'],
  documentCase: ['verify', 'reject', 'update', 'delete'],
  match: [
    'create',
    'update',
    'delete',
    'restore',
    'verify',
    'query-case-matches',
  ],
});

const adminRole = adminPluginAcl.newRole({
  documentType: ['create', 'update', 'delete', 'restore'],
  addressLocale: ['create', 'update', 'delete', 'restore'],
  pickupStation: ['create', 'update', 'delete', 'restore'],
  documentCase: ['verify', 'reject', 'update', 'delete'],
  match: [
    'create',
    'update',
    'delete',
    'restore',
    'verify',
    'query-case-matches',
  ],
  ...adminAc.statements,
});

const userRole = adminPluginAcl.newRole({
  documentType: [],
  addressLocale: [],
  ...userAc.statements,
});

export const adminPluginRoles = {
  ...adminDefaultRoles,
  admin: adminRole,
  user: userRole,
};
