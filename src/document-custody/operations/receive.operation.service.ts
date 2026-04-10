import { BadRequestException, Injectable } from '@nestjs/common';
import { CustodyStatus } from '../../../generated/prisma/client';
import { UserSession } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentCustodyPermissionService } from '../document-custody-permission.service';
import { RecordReceivedDto } from '../document-custody.dto';
import { CustodyOperationCode } from './custody-operation-code.enum';
import { CustodyOperationHelperService } from './custody-operation-helper.service';

@Injectable()
export class ReceiveOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permission: DocumentCustodyPermissionService,
    private readonly helper: CustodyOperationHelperService,
  ) {}

  async execute(
    foundCaseId: string,
    dto: RecordReceivedDto,
    user: UserSession['user'],
  ) {
    await this.permission.assertPermission(
      user.id,
      dto.stationId,
      CustodyOperationCode.RECEIVED,
    );
    const foundCase = await this.helper.getFoundCase(foundCaseId);
    const opType = await this.helper.getOperationType(
      CustodyOperationCode.RECEIVED,
    );

    const validFrom: CustodyStatus[] = [
      CustodyStatus.WITH_FINDER,
      CustodyStatus.IN_TRANSIT,
    ];
    if (!validFrom.includes(foundCase.custodyStatus)) {
      throw new BadRequestException(
        `Cannot record RECEIVED from custody status ${foundCase.custodyStatus}`,
      );
    }

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
