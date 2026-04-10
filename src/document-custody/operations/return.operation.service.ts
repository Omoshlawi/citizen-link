import { BadRequestException, Injectable } from '@nestjs/common';
import { CustodyStatus } from '../../../generated/prisma/client';
import { UserSession } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentCustodyPermissionService } from '../document-custody-permission.service';
import { RecordReturnDto } from '../document-custody.dto';
import { CustodyOperationCode } from './custody-operation-code.enum';
import { CustodyOperationHelperService } from './custody-operation-helper.service';

@Injectable()
export class ReturnOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permission: DocumentCustodyPermissionService,
    private readonly helper: CustodyOperationHelperService,
  ) {}

  async execute(
    foundCaseId: string,
    dto: RecordReturnDto,
    user: UserSession['user'],
  ) {
    await this.permission.assertPermission(
      user.id,
      dto.stationId,
      CustodyOperationCode.RETURN,
    );
    const foundCase = await this.helper.getFoundCase(foundCaseId);

    const validFrom: CustodyStatus[] = [
      CustodyStatus.IN_TRANSIT,
      CustodyStatus.HANDED_OVER,
    ];
    if (!validFrom.includes(foundCase.custodyStatus)) {
      throw new BadRequestException(
        `Cannot record return from custody status ${foundCase.custodyStatus}`,
      );
    }

    const opType = await this.helper.getOperationType(
      CustodyOperationCode.RETURN,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          custodyStatus: CustodyStatus.IN_CUSTODY,
          currentStationId: dto.stationId,
        },
      });

      return this.helper.createOperation(tx, {
        foundCaseId,
        operationTypeId: opType.id,
        operationPrefix: opType.prefix,
        performedById: user.id,
        custodyStatusBefore: foundCase.custodyStatus,
        custodyStatusAfter: CustodyStatus.IN_CUSTODY,
        stationId: dto.stationId,
        notes: dto.notes,
      });
    });
  }
}
