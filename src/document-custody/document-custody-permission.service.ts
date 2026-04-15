import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustodyOperationCode } from './operations/custody-operation-code.enum';

@Injectable()
export class DocumentCustodyPermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convenience wrapper that resolves the acting station from an operation shape
   * and delegates to assertPermission. Skips silently when no station applies
   * (station-agnostic operations such as AUDIT / CONDITION_UPDATE).
   *
   * TRANSFER_OUT: acting staff is at the sending station (fromStationId).
   * All other types: acting staff is at the primary station (stationId).
   */
  async assertPermissionForOperation(
    userId: string,
    op: {
      stationId: string | null;
      fromStationId: string | null;
      operationType: { code: string };
    },
  ): Promise<void> {
    const actingStationId =
      (op.operationType.code as CustodyOperationCode) ===
      CustodyOperationCode.TRANSFER_OUT
        ? op.fromStationId
        : op.stationId;

    if (!actingStationId) return;

    await this.assertPermission(
      userId,
      actingStationId,
      op.operationType.code as CustodyOperationCode,
    );
  }

  /**
   * Validates that:
   * 1. The operation type exists and is enabled at the given station (station ceiling).
   * 2. The user has an active grant to perform the operation at the station (staff grant).
   */
  async assertPermission(
    userId: string,
    stationId: string,
    operationCode: CustodyOperationCode,
  ): Promise<void> {
    const opType = await this.prisma.documentOperationType.findUnique({
      where: { code: operationCode, voided: false },
    });
    if (!opType)
      throw new BadRequestException(`Unknown operation: ${operationCode}`);

    // Layer 1: station ceiling
    const stationCeiling = await this.prisma.stationOperationType.findUnique({
      where: {
        stationId_operationTypeId: {
          stationId,
          operationTypeId: opType.id,
        },
        voided: false,
      },
    });
    if (!stationCeiling || !stationCeiling.isEnabled) {
      throw new ForbiddenException(
        `Operation ${operationCode} is not permitted at this station`,
      );
    }

    // Layer 2: staff grant
    const grant = await this.prisma.staffStationOperation.findUnique({
      where: {
        userId_stationId_operationTypeId: {
          userId,
          stationId,
          operationTypeId: opType.id,
        },
        voided: false,
      },
    });
    if (!grant) {
      throw new ForbiddenException(
        `You are not authorised to perform ${operationCode} at this station`,
      );
    }
  }
}
