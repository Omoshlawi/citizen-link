import { BadRequestException, Injectable } from '@nestjs/common';
import { CustodyStatus } from '../../../generated/prisma/client';
import { UserSession } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentCustodyPermissionService } from '../document-custody-permission.service';
import { RecordDisposalDto } from '../document-custody.dto';
import { CustodyOperationCode } from './custody-operation-code.enum';
import { CustodyOperationHelperService } from './custody-operation-helper.service';

@Injectable()
export class DisposalOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permission: DocumentCustodyPermissionService,
    private readonly helper: CustodyOperationHelperService,
  ) {}

  async execute(
    foundCaseId: string,
    dto: RecordDisposalDto,
    user: UserSession['user'],
  ) {
    await this.permission.assertPermission(
      user.id,
      dto.stationId,
      CustodyOperationCode.DISPOSAL,
    );
    const foundCase = await this.helper.getFoundCase(foundCaseId);

    if (foundCase.custodyStatus !== CustodyStatus.IN_CUSTODY) {
      throw new BadRequestException(
        `Cannot record disposal from custody status ${foundCase.custodyStatus}`,
      );
    }

    const opType = await this.helper.getOperationType(
      CustodyOperationCode.DISPOSAL,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          custodyStatus: CustodyStatus.DISPOSED,
          currentStationId: null,
        },
      });

      return this.helper.createOperation(tx, {
        foundCaseId,
        operationTypeId: opType.id,
        operationPrefix: opType.prefix,
        performedById: user.id,
        custodyStatusBefore: CustodyStatus.IN_CUSTODY,
        custodyStatusAfter: CustodyStatus.DISPOSED,
        stationId: dto.stationId,
        notes: dto.notes,
      });
    });
  }
}
