import { CustodyStatus, Prisma } from '../../generated/prisma/client';
import { CustodyOperationCode } from './operations/custody-operation-code.enum';

// ── Custody transition map ────────────────────────────────────────────────────
// Defines how each operation code mutates a found case's custody status.
// Operations not listed here (AUDIT, CONDITION_UPDATE, REQUISITION) are
// no-ops: they record the current status as both before and after.

export type CustodyTransitionFn = (
  tx: Prisma.TransactionClient,
  item: { foundCaseId: string },
  op: { stationId: string | null; toStationId: string | null },
) => Promise<{ before: CustodyStatus; after: CustodyStatus }>;

export const CUSTODY_TRANSITION: Record<string, CustodyTransitionFn> = {
  [CustodyOperationCode.RECEIVED]: async (tx, item, op) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    await tx.foundDocumentCase.update({
      where: { id: item.foundCaseId },
      data: {
        custodyStatus: CustodyStatus.IN_CUSTODY,
        currentStationId: op.stationId,
      },
    });
    return { before: fc.custodyStatus, after: CustodyStatus.IN_CUSTODY };
  },

  [CustodyOperationCode.TRANSFER_OUT]: async (tx, item) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    await tx.foundDocumentCase.update({
      where: { id: item.foundCaseId },
      data: { custodyStatus: CustodyStatus.IN_TRANSIT, currentStationId: null },
    });
    return { before: fc.custodyStatus, after: CustodyStatus.IN_TRANSIT };
  },

  [CustodyOperationCode.TRANSFER_IN]: async (tx, item, op) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    await tx.foundDocumentCase.update({
      where: { id: item.foundCaseId },
      data: {
        custodyStatus: CustodyStatus.IN_CUSTODY,
        currentStationId: op.stationId,
      },
    });
    return { before: fc.custodyStatus, after: CustodyStatus.IN_CUSTODY };
  },

  [CustodyOperationCode.HANDOVER]: async (tx, item) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    await tx.foundDocumentCase.update({
      where: { id: item.foundCaseId },
      data: { custodyStatus: CustodyStatus.HANDED_OVER },
    });
    return { before: fc.custodyStatus, after: CustodyStatus.HANDED_OVER };
  },

  [CustodyOperationCode.DISPOSAL]: async (tx, item) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    await tx.foundDocumentCase.update({
      where: { id: item.foundCaseId },
      data: { custodyStatus: CustodyStatus.DISPOSED },
    });
    return { before: fc.custodyStatus, after: CustodyStatus.DISPOSED };
  },

  [CustodyOperationCode.RETURN]: async (tx, item, op) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    await tx.foundDocumentCase.update({
      where: { id: item.foundCaseId },
      data: {
        custodyStatus: CustodyStatus.IN_CUSTODY,
        currentStationId: op.stationId,
      },
    });
    return { before: fc.custodyStatus, after: CustodyStatus.IN_CUSTODY };
  },

  // No custody change — snapshot current status
  [CustodyOperationCode.REQUISITION]: async (tx, item) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    return { before: fc.custodyStatus, after: fc.custodyStatus };
  },
  [CustodyOperationCode.AUDIT]: async (tx, item) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    return { before: fc.custodyStatus, after: fc.custodyStatus };
  },
  [CustodyOperationCode.CONDITION_UPDATE]: async (tx, item) => {
    const fc = await tx.foundDocumentCase.findUniqueOrThrow({
      where: { id: item.foundCaseId },
    });
    return { before: fc.custodyStatus, after: fc.custodyStatus };
  },
};

// ── Default custom representation ─────────────────────────────────────────────
// Used when no ?v= param is provided. Covers the web dashboard's needs:
// operation type, stations, creator, and items with their found case details.

export const DEFAULT_OPERATION_REP =
  'custom:include(operationType,station,fromStation,toStation,requestedByStation,createdBy,items:include(foundCase:include(case:include(document:include(type)))))' as const;
