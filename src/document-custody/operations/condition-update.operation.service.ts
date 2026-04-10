import { Injectable } from '@nestjs/common';
import { UserSession } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentCustodyPermissionService } from '../document-custody-permission.service';
import { RecordConditionUpdateDto } from '../document-custody.dto';
import { CustodyOperationCode } from './custody-operation-code.enum';
import { CustodyOperationHelperService } from './custody-operation-helper.service';

@Injectable()
export class ConditionUpdateOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permission: DocumentCustodyPermissionService,
    private readonly helper: CustodyOperationHelperService,
  ) {}

  async execute(
    foundCaseId: string,
    dto: RecordConditionUpdateDto,
    user: UserSession['user'],
  ) {
    await this.permission.assertPermission(
      user.id,
      dto.stationId,
      CustodyOperationCode.CONDITION_UPDATE,
    );
    const foundCase = await this.helper.getFoundCase(foundCaseId);
    this.helper.assertNotTerminal(foundCase.custodyStatus);

    const opType = await this.helper.getOperationType(
      CustodyOperationCode.CONDITION_UPDATE,
    );

    return this.prisma.$transaction(async (tx) => {
      return this.helper.createOperation(tx, {
        foundCaseId,
        operationTypeId: opType.id,
        operationPrefix: opType.prefix,
        performedById: user.id,
        custodyStatusBefore: foundCase.custodyStatus,
        custodyStatusAfter: foundCase.custodyStatus, // no change
        stationId: dto.stationId,
        notes: dto.notes,
        metadata: dto.metadata as Record<string, unknown>,
      });
    });
  }
}
