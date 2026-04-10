import { BadRequestException, Injectable } from '@nestjs/common';
import { CustodyStatus } from '../../../generated/prisma/client';
import { UserSession } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentCustodyPermissionService } from '../document-custody-permission.service';
import {
  ConfirmTransferDto,
  InitiateTransferDto,
} from '../document-custody.dto';
import { CustodyOperationCode } from './custody-operation-code.enum';
import { CustodyOperationHelperService } from './custody-operation-helper.service';

@Injectable()
export class TransferOperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permission: DocumentCustodyPermissionService,
    private readonly helper: CustodyOperationHelperService,
  ) {}

  async initiate(
    foundCaseId: string,
    dto: InitiateTransferDto,
    user: UserSession['user'],
  ) {
    const foundCase = await this.helper.getFoundCase(foundCaseId);
    if (!foundCase.currentStationId) {
      throw new BadRequestException('Document has no current station assigned');
    }
    await this.permission.assertPermission(
      user.id,
      foundCase.currentStationId,
      CustodyOperationCode.TRANSFER_OUT,
    );

    if (foundCase.custodyStatus !== CustodyStatus.IN_CUSTODY) {
      throw new BadRequestException(
        `Cannot initiate transfer from custody status ${foundCase.custodyStatus}`,
      );
    }
    if (dto.toStationId === foundCase.currentStationId) {
      throw new BadRequestException(
        'Destination station must be different from current station',
      );
    }

    const opType = await this.helper.getOperationType(
      CustodyOperationCode.TRANSFER_OUT,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: { custodyStatus: CustodyStatus.IN_TRANSIT },
      });

      return this.helper.createOperation(tx, {
        foundCaseId,
        operationTypeId: opType.id,
        operationPrefix: opType.prefix,
        performedById: user.id,
        custodyStatusBefore: CustodyStatus.IN_CUSTODY,
        custodyStatusAfter: CustodyStatus.IN_TRANSIT,
        stationId: foundCase.currentStationId!,
        fromStationId: foundCase.currentStationId!,
        toStationId: dto.toStationId,
        notes: dto.notes,
      });
    });
  }

  async confirm(
    foundCaseId: string,
    dto: ConfirmTransferDto,
    user: UserSession['user'],
  ) {
    const foundCase = await this.helper.getFoundCase(foundCaseId);

    const pairedOp = await this.prisma.documentOperation.findUnique({
      where: { id: dto.pairedOperationId },
      include: { operationType: true },
    });
    if (!pairedOp || pairedOp.foundCaseId !== foundCaseId) {
      throw new BadRequestException('Invalid paired operation');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (pairedOp.operationType.code !== CustodyOperationCode.TRANSFER_OUT) {
      throw new BadRequestException(
        'Paired operation must be a ' + CustodyOperationCode.TRANSFER_OUT,
      );
    }
    if (pairedOp.pairedOperationId !== null) {
      throw new BadRequestException('Paired operation already confirmed');
    }
    if (!pairedOp.toStationId) {
      throw new BadRequestException(
        'Paired operation has no destination station',
      );
    }

    await this.permission.assertPermission(
      user.id,
      pairedOp.toStationId,
      CustodyOperationCode.TRANSFER_IN,
    );

    if (foundCase.custodyStatus !== CustodyStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Cannot confirm transfer from custody status ${foundCase.custodyStatus}`,
      );
    }

    const opType = await this.helper.getOperationType(
      CustodyOperationCode.TRANSFER_IN,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          custodyStatus: CustodyStatus.IN_CUSTODY,
          currentStationId: pairedOp.toStationId,
        },
      });

      const inboundOp = await this.helper.createOperation(tx, {
        foundCaseId,
        operationTypeId: opType.id,
        operationPrefix: opType.prefix,
        performedById: user.id,
        custodyStatusBefore: CustodyStatus.IN_TRANSIT,
        custodyStatusAfter: CustodyStatus.IN_CUSTODY,
        stationId: pairedOp.toStationId!,
        fromStationId: pairedOp.fromStationId!,
        toStationId: pairedOp.toStationId!,
        pairedOperationId: pairedOp.id,
        notes: dto.notes,
      });

      // Link TRANSFER_OUT → TRANSFER_IN
      await tx.documentOperation.update({
        where: { id: pairedOp.id },
        data: { pairedOperationId: inboundOp.id },
      });

      return inboundOp;
    });
  }
}
