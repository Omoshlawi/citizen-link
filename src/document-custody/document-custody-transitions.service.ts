import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustodyStatus,
  DocumentOperationItemStatus,
  DocumentOperationStatus,
  Prisma,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { CustomRepresentationService } from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { CancelOperationDto, RejectOperationDto } from './document-custody.dto';
import {
  CUSTODY_TRANSITION,
  DEFAULT_OPERATION_REP,
} from './document-custody.constants';

@Injectable()
export class DocumentCustodyTransitionsService {
  private readonly defaultRep = DEFAULT_OPERATION_REP;

  constructor(
    private readonly prisma: PrismaService,
    private readonly representationService: CustomRepresentationService,
  ) {}

  /**
   * Submit an operation for approval
   * @param id
   * @param user
   * @param v
   * @returns
   */
  async submit(id: string, user: UserSession['user'], v?: string) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
      include: { operationType: true, items: true },
    });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== DocumentOperationStatus.DRAFT)
      throw new ConflictException(
        `Only ${DocumentOperationStatus.DRAFT} operations can be submitted`,
      );
    if (op.items.length === 0)
      throw new BadRequestException('Cannot submit an operation with no items');

    const rep = this.representationService.buildCustomRepresentationQuery(
      v ?? this.defaultRep,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentOperation.update({
        where: { id },
        data: { status: DocumentOperationStatus.SUBMITTED },
        ...rep,
      });
      await this.logTransition(tx, {
        entityId: id,
        fromStatus: DocumentOperationStatus.DRAFT,
        toStatus: DocumentOperationStatus.SUBMITTED,
        changedById: user.id,
        reasonCode: 'STAFF_SUBMITTED',
      });
      return updated;
    });
  }

  /**
   * Approve an operation
   * @param id
   * @param user
   * @param v
   * @returns
   */
  async approve(id: string, user: UserSession['user'], v?: string) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
    });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== DocumentOperationStatus.SUBMITTED)
      throw new ConflictException(
        `Only ${DocumentOperationStatus.SUBMITTED} operations can be approved`,
      );

    const rep = this.representationService.buildCustomRepresentationQuery(
      v ?? this.defaultRep,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentOperation.update({
        where: { id },
        data: { status: DocumentOperationStatus.APPROVED },
        ...rep,
      });
      await this.logTransition(tx, {
        entityId: id,
        fromStatus: DocumentOperationStatus.SUBMITTED,
        toStatus: DocumentOperationStatus.APPROVED,
        changedById: user.id,
        reasonCode: 'SUPERVISOR_APPROVED',
      });
      return updated;
    });
  }

  /**
   * Reject an operation
   * Return the operation back to draft for the staff to fix and resubmit
   * @param id
   * @param dto
   * @param user
   * @param v
   * @returns
   */
  async reject(
    id: string,
    dto: RejectOperationDto,
    user: UserSession['user'],
    v?: string,
  ) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
    });
    if (!op) throw new NotFoundException('Operation not found');
    if (op.status !== DocumentOperationStatus.SUBMITTED)
      throw new ConflictException(
        `Only ${DocumentOperationStatus.SUBMITTED} operations can be rejected`,
      );

    const rep = this.representationService.buildCustomRepresentationQuery(
      v ?? this.defaultRep,
    );

    return this.prisma.$transaction(async (tx) => {
      // Status lands back on DRAFT so staff can fix and resubmit
      const updated = await tx.documentOperation.update({
        where: { id },
        data: { status: DocumentOperationStatus.DRAFT },
        ...rep,
      });
      await this.logTransition(tx, {
        entityId: id,
        fromStatus: DocumentOperationStatus.SUBMITTED,
        toStatus: DocumentOperationStatus.REJECTED,
        changedById: user.id,
        reasonCode: dto.reasonCode,
        comment: dto.comment,
      });
      // Immediately record return to DRAFT
      await this.logTransition(tx, {
        entityId: id,
        fromStatus: DocumentOperationStatus.REJECTED,
        toStatus: DocumentOperationStatus.DRAFT,
        changedById: user.id,
        reasonCode: 'RETURNED_TO_DRAFT',
        comment: 'Returned to draft after rejection',
      });
      return updated;
    });
  }

  /**
   * Execute an operation
   * @param id
   * @param user
   * @param v
   * @returns
   */
  async execute(id: string, user: UserSession['user'], v?: string) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
      include: { operationType: true, items: true },
    });
    if (!op) throw new NotFoundException('Operation not found');

    const validStatuses = [
      DocumentOperationStatus.DRAFT,
      DocumentOperationStatus.APPROVED,
    ];
    if (!validStatuses.includes(op.status as (typeof validStatuses)[number]))
      throw new ConflictException(
        `Only ${DocumentOperationStatus.DRAFT} or ${DocumentOperationStatus.APPROVED} operations can be executed`,
      );

    if (
      op.operationType.isHighPrivilege &&
      op.status === DocumentOperationStatus.DRAFT
    )
      throw new ConflictException(
        'This operation type requires supervisor approval before execution',
      );

    if (op.items.length === 0)
      throw new BadRequestException(
        'Cannot execute an operation with no items',
      );

    const fromStatus = op.status;
    const applyCustody = CUSTODY_TRANSITION[op.operationType.code];
    const rep = this.representationService.buildCustomRepresentationQuery(
      v ?? this.defaultRep,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.documentOperation.update({
        where: { id },
        data: { status: DocumentOperationStatus.IN_PROGRESS },
      });

      let failedCount = 0;
      for (const item of op.items) {
        try {
          let before: CustodyStatus = CustodyStatus.WITH_FINDER;
          let after: CustodyStatus = CustodyStatus.WITH_FINDER;
          if (applyCustody) {
            const result = await applyCustody(tx, item, op);
            before = result.before;
            after = result.after;
          }
          await tx.documentOperationItem.update({
            where: { id: item.id },
            data: {
              status: DocumentOperationItemStatus.COMPLETED,
              custodyStatusBefore: before,
              custodyStatusAfter: after,
            },
          });
        } catch {
          failedCount++;
          await tx.documentOperationItem.update({
            where: { id: item.id },
            data: { status: DocumentOperationItemStatus.FAILED },
          });
        }
      }

      const updated = await tx.documentOperation.update({
        where: { id },
        data: {
          status: DocumentOperationStatus.COMPLETED,
          completedAt: new Date(),
        },
        ...rep,
      });

      await this.logTransition(tx, {
        entityId: id,
        fromStatus,
        toStatus: DocumentOperationStatus.COMPLETED,
        changedById: user.id,
        reasonCode: 'OPERATION_EXECUTED',
        comment: failedCount > 0 ? `${failedCount} item(s) failed` : undefined,
      });

      return updated;
    });
  }

  /**
   * Cancel an operation
   * @param id
   * @param dto
   * @param user
   * @param v
   * @returns
   */
  async cancel(
    id: string,
    dto: CancelOperationDto,
    user: UserSession['user'],
    v?: string,
  ) {
    const op = await this.prisma.documentOperation.findUnique({
      where: { id },
    });
    if (!op) throw new NotFoundException('Operation not found');

    const terminalStatuses = [
      DocumentOperationStatus.COMPLETED,
      DocumentOperationStatus.CANCELLED,
    ];
    if (
      terminalStatuses.includes(op.status as (typeof terminalStatuses)[number])
    )
      throw new ConflictException(
        'Completed or already cancelled operations cannot be cancelled',
      );

    const rep = this.representationService.buildCustomRepresentationQuery(
      v ?? this.defaultRep,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentOperation.update({
        where: { id },
        data: { status: DocumentOperationStatus.CANCELLED },
        ...rep,
      });
      await this.logTransition(tx, {
        entityId: id,
        fromStatus: op.status,
        toStatus: DocumentOperationStatus.CANCELLED,
        changedById: user.id,
        reasonCode: dto.reasonCode,
        comment: dto.comment,
      });
      return updated;
    });
  }

  //  Internal helpers

  private async logTransition(
    tx: Prisma.TransactionClient,
    params: {
      entityId: string;
      fromStatus: string;
      toStatus: string;
      changedById: string;
      reasonCode: string;
      comment?: string;
    },
  ) {
    const reason = await tx.transitionReason.findFirst({
      where: {
        entityType: 'DocumentOperation',
        code: params.reasonCode,
        voided: false,
      },
    });
    await tx.statusTransition.create({
      data: {
        entityId: params.entityId,
        entityType: 'DocumentOperation',
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        changedById: params.changedById,
        reasonId: reason?.id ?? null,
        comment: params.comment ?? null,
      },
    });
  }
}
