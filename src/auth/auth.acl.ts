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
});

const adminRole = adminPluginAcl.newRole({
  documentType: ['create', 'update', 'delete', 'restore'],
  ...adminAc.statements,
});

const userRole = adminPluginAcl.newRole({
  documentType: [],
  ...userAc.statements,
});

export const adminPluginRoles = {
  ...adminDefaultRoles,
  admin: adminRole,
  user: userRole,
};
