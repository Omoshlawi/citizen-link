import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  userAc,
  defaultStatements as defaultAdminStatements,
  defaultRoles as adminDefaultRoles,
} from 'better-auth/plugins/admin/access';

export const adminPluginAcl = createAccessControl({
  ...defaultAdminStatements,
  customer: ['create', 'list', 'update', 'delete', 'restore'],
});

const adminRole = adminPluginAcl.newRole({
  customer: ['create', 'delete', 'list', 'update', 'restore'],
  ...adminAc.statements,
});

const userRole = adminPluginAcl.newRole({
  customer: ['list'],
  ...userAc.statements,
});

export const adminPluginRoles = {
  ...adminDefaultRoles,
  admin: adminRole,
  user: userRole,
};
