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
  documentCase: [
    'list-any',
    'view-any',
    'verify',
    'reject',
    'update',
    'delete',
    'collect',
  ],
  match: [
    'list-any',
    'create',
    'update',
    'delete',
    'restore',
    'verify',
    'query-case-matches',
  ],
  claim: ['list-any', 'verify', 'reject', 'delete', 'review-dispute'],
  extraction: ['debug'],
  templates: ['create', 'update', 'delete', 'restore'],
  notification: ['list-any', 'view-any', 'manage-any', 'delete', 'test'],
  transitionReason: ['create', 'update', 'delete', 'restore'],
  statusTransition: ['view'],
  documentOperation: ['manage', 'approve', 'reject'],
  documentOperationType: ['manage'],
  stationOperationType: ['manage'],
  staffStationOperation: ['view', 'manage'],
  wallet: ['view-any'],
  address: ['view-any'],
  transaction: ['list-any'],
  disbursement: ['list-any', 'view-any'],
  invoice: ['list-any'],
  setting: ['view-any', 'manage-system'],
  pushToken: ['list-any'],
  handover: ['manage-any'],
});

const adminRole = adminPluginAcl.newRole({
  documentType: ['create', 'update', 'delete', 'restore'],
  addressLocale: ['create', 'update', 'delete', 'restore'],
  addressHierarchy: ['create', 'update', 'delete', 'restore'],
  pickupStation: ['create', 'update', 'delete', 'restore'],
  documentCase: [
    'list-any',
    'view-any',
    'verify',
    'reject',
    'update',
    'delete',
    'collect',
  ],
  match: [
    'list-any',
    'create',
    'update',
    'delete',
    'restore',
    'verify',
    'query-case-matches',
  ],
  claim: ['list-any', 'verify', 'reject', 'delete', 'review-dispute'],
  extraction: ['debug'],
  templates: ['create', 'update', 'delete', 'restore'],
  notification: ['list-any', 'view-any', 'manage-any', 'delete', 'test'],
  transitionReason: ['create', 'update', 'delete', 'restore'],
  statusTransition: ['view'],
  documentOperation: ['manage', 'approve', 'reject'],
  documentOperationType: ['manage'],
  stationOperationType: ['manage'],
  staffStationOperation: ['view', 'manage'],
  wallet: ['view-any'],
  address: ['view-any'],
  transaction: ['list-any'],
  disbursement: ['list-any', 'view-any'],
  invoice: ['list-any'],
  setting: ['view-any', 'manage-system'],
  pushToken: ['list-any'],
  handover: ['manage-any'],
  ...adminAc.statements,
});

// Base staff role
const staffRole = adminPluginAcl.newRole({
  ...userAc.statements,
  address: ['view-any'],
  documentOperation: ['manage'],
});

const userRole = adminPluginAcl.newRole({
  documentType: [],
  addressLocale: [],
  ...userAc.statements,
});

// Additional roles — assigned to staff users via comma-separated role string
// e.g. user.role = "staff,case-verifier"

const caseVerifierRole = adminPluginAcl.newRole({
  documentCase: ['list-any', 'view-any', 'verify', 'reject'],
});

const collectionOfficerRole = adminPluginAcl.newRole({
  documentCase: ['list-any', 'view-any', 'collect'],
});

const caseManagerRole = adminPluginAcl.newRole({
  documentCase: ['list-any', 'view-any', 'update', 'delete'],
});

const matchOfficerRole = adminPluginAcl.newRole({
  documentCase: ['list-any', 'view-any'],
  match: [
    'list-any',
    'query-case-matches',
    'verify',
    'create',
    'update',
    'delete',
    'restore',
  ],
});

const claimReviewerRole = adminPluginAcl.newRole({
  claim: ['list-any', 'verify', 'reject', 'delete', 'review-dispute'],
  documentCase: ['view-any'],
});

const contentAdminRole = adminPluginAcl.newRole({
  documentType: ['create', 'update', 'delete', 'restore'],
  addressLocale: ['create', 'update', 'delete', 'restore'],
  addressHierarchy: ['create', 'update', 'delete', 'restore'],
  pickupStation: ['create', 'update', 'delete', 'restore'],
  templates: ['create', 'update', 'delete', 'restore'],
  transitionReason: ['create', 'update', 'delete', 'restore'],
});

const notificationAdminRole = adminPluginAcl.newRole({
  notification: ['list-any', 'view-any', 'manage-any', 'delete', 'test'],
});

const extractionDebuggerRole = adminPluginAcl.newRole({
  extraction: ['debug'],
});

const stationManagerRole = adminPluginAcl.newRole({
  staffStationOperation: ['view', 'manage'],
  documentOperation: ['manage', 'approve', 'reject'],
  documentOperationType: ['manage'],
  stationOperationType: ['manage'],
  handover: ['manage-any'],
  pushToken: ['list-any'],
});

const operationApproverRole = adminPluginAcl.newRole({
  documentOperation: ['manage', 'approve', 'reject'],
});

const financeOfficerRole = adminPluginAcl.newRole({
  wallet: ['view-any'],
  transaction: ['list-any'],
  disbursement: ['list-any', 'view-any'],
  invoice: ['list-any'],
});

const systemAdminRole = adminPluginAcl.newRole({
  setting: ['view-any', 'manage-system'],
  address: ['view-any'],
  statusTransition: ['view'],
});

export const adminPluginRoles = {
  ...adminDefaultRoles,
  admin: adminRole,
  staff: staffRole,
  user: userRole,
  'case-verifier': caseVerifierRole,
  'collection-officer': collectionOfficerRole,
  'case-manager': caseManagerRole,
  'match-officer': matchOfficerRole,
  'claim-reviewer': claimReviewerRole,
  'content-admin': contentAdminRole,
  'notification-admin': notificationAdminRole,
  'extraction-debugger': extractionDebuggerRole,
  'station-manager': stationManagerRole,
  'operation-approver': operationApproverRole,
  'finance-officer': financeOfficerRole,
  'system-admin': systemAdminRole,
};
