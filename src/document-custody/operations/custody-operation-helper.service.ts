import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustodyStatus,
  DocumentOperation,
  Prisma,
} from '../../../generated/prisma/client';
import { EntityPrefix } from '../../human-id/human-id.constants';
import { HumanIdService } from '../../human-id/human-id.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CustodyOperationCode } from './custody-operation-code.enum';

export const TERMINAL_STATUSES: CustodyStatus[] = [
  CustodyStatus.HANDED_OVER,
  CustodyStatus.DISPOSED,
];

export type CreateOperationParams = {
  foundCaseId: string;
  operationTypeId: string;
  operationPrefix: string;
  performedById: string;
  custodyStatusBefore: CustodyStatus;
  custodyStatusAfter: CustodyStatus;
  stationId?: string;
  fromStationId?: string;
  toStationId?: string;
  requestedByStationId?: string;
  pairedOperationId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class CustodyOperationHelperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly humanId: HumanIdService,
  ) {}

  async getFoundCase(foundCaseId: string) {
    const foundCase = await this.prisma.foundDocumentCase.findUnique({
      where: { id: foundCaseId },
    });
    if (!foundCase)
      throw new NotFoundException('Found document case not found');
    return foundCase;
  }

  assertNotTerminal(custodyStatus: CustodyStatus) {
    if (TERMINAL_STATUSES.includes(custodyStatus)) {
      throw new BadRequestException(
        `Cannot record operations on a document with custody status ${custodyStatus}`,
      );
    }
  }

  async getOperationType(code: CustodyOperationCode) {
    const opType = await this.prisma.documentOperationType.findUnique({
      where: { code, voided: false },
    });
    if (!opType)
      throw new BadRequestException(`Unknown operation type: ${code}`);
    return opType;
  }

  async createOperation(
    tx: Prisma.TransactionClient,
    params: CreateOperationParams,
  ): Promise<DocumentOperation> {
    const operationNumber = await this.humanId.generate({
      prefix: params.operationPrefix as EntityPrefix,
    });

    return tx.documentOperation.create({
      data: {
        operationNumber,
        foundCaseId: params.foundCaseId,
        operationTypeId: params.operationTypeId,
        performedById: params.performedById,
        custodyStatusBefore: params.custodyStatusBefore,
        custodyStatusAfter: params.custodyStatusAfter,
        stationId: params.stationId ?? null,
        fromStationId: params.fromStationId ?? null,
        toStationId: params.toStationId ?? null,
        requestedByStationId: params.requestedByStationId ?? null,
        pairedOperationId: params.pairedOperationId ?? null,
        notes: params.notes ?? null,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: (params.metadata as any) ?? undefined,
      },
    });
  }
}
