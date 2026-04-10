import { Injectable } from '@nestjs/common';
import { UserSession } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentCustodyPermissionService } from '../document-custody-permission.service';
import { CreateRequisitionDto } from '../document-custody.dto';
import { CustodyOperationCode } from './custody-operation-code.enum';
import { CustodyOperationHelperService } from './custody-operation-helper.service';

@Injectable()
export class RequisitionOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permission: DocumentCustodyPermissionService,
    private readonly helper: CustodyOperationHelperService,
  ) {}

  async execute(
    foundCaseId: string,
    dto: CreateRequisitionDto,
    user: UserSession['user'],
  ) {
    const foundCase = await this.helper.getFoundCase(foundCaseId);
    this.helper.assertNotTerminal(foundCase.custodyStatus);
    await this.permission.assertPermission(
      user.id,
      dto.requestingStationId,
      CustodyOperationCode.REQUISITION,
    );

    const opType = await this.helper.getOperationType(
      CustodyOperationCode.REQUISITION,
    );

    return this.prisma.$transaction(async (tx) => {
      return this.helper.createOperation(tx, {
        foundCaseId,
        operationTypeId: opType.id,
        operationPrefix: opType.prefix,
        performedById: user.id,
        custodyStatusBefore: foundCase.custodyStatus,
        custodyStatusAfter: foundCase.custodyStatus, // no change
        stationId: foundCase.currentStationId ?? undefined,
        requestedByStationId: dto.requestingStationId,
        notes: dto.notes,
      });
    });
  }
}
