/**
 * Canonical operation codes stored in the DocumentOperationType table.
 * Update here only — all services reference this enum instead of raw strings.
 */
export enum CustodyOperationCode {
  RECEIVED = 'RECEIVED',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
  REQUISITION = 'REQUISITION',
  HANDOVER = 'HANDOVER',
  DISPOSAL = 'DISPOSAL',
  RETURN = 'RETURN',
  AUDIT = 'AUDIT',
  CONDITION_UPDATE = 'CONDITION_UPDATE',
}
