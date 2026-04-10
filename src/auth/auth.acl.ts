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
  addressHierarchy: ['create', 'update', 'delete', 'restore'],
  pickupStation: ['create', 'update', 'delete', 'restore'],
  documentCase: ['verify', 'reject', 'update', 'delete', 'collect'],
  match: [
    'create',
    'update',
    'delete',
    'restore',
    'verify',
    'query-case-matches',
  ],
  claim: ['verify', 'reject', 'delete', 'review-dispute'],
  extraction: ['debug'],
  templates: ['create', 'update', 'delete', 'restore'],
  notification: ['delete', 'test'],
  transitionReason: ['create', 'update', 'delete', 'restore', 'restore'],
  statusTransition: ['view'],
  documentOperationType: ['manage'],
  stationOperationType: ['manage'],
  staffStationOperation: ['view', 'manage'],
});

const adminRole = adminPluginAcl.newRole({
  documentType: ['create', 'update', 'delete', 'restore'],
  addressLocale: ['create', 'update', 'delete', 'restore'],
  addressHierarchy: ['create', 'update', 'delete', 'restore'],
  pickupStation: ['create', 'update', 'delete', 'restore'],
  documentCase: ['verify', 'reject', 'update', 'delete', 'collect'],
  match: [
    'create',
    'update',
    'delete',
    'restore',
    'verify',
    'query-case-matches',
  ],
  claim: ['verify', 'reject', 'delete', 'review-dispute'],
  extraction: ['debug'],
  templates: ['create', 'update', 'delete', 'restore'],
  notification: ['delete', 'test'],
  transitionReason: ['create', 'update', 'delete', 'restore', 'restore'],
  statusTransition: ['view'],
  documentOperationType: ['manage'],
  stationOperationType: ['manage'],
  staffStationOperation: ['view', 'manage'],
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
