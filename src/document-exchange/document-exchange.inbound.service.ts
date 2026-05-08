import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import z from 'zod';
import {
  CustodyStatus,
  ExchangeDirection,
  ExchangeMethod,
  ExchangeStatus,
  ExtractionStatus,
  FoundDocumentCaseStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { SystemSettingService } from '../common/settings/settings.system.service';
import { HumanIdService } from '../human-id/human-id.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import {
  CancelExchangeDto,
  CancelVerificationDto,
  IssueVerificationResponseDto,
  ScheduleInboundExchangeDto,
  VerifyExchangeCodeDto,
} from './document-exchange.dto';

@Injectable()
export class DocumentExchangeInboundService {
  private readonly logger = new Logger(DocumentExchangeInboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SystemSettingService,
    private readonly humanId: HumanIdService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  private async getFoundCaseForExchange(foundCaseId: string) {
    const foundCase = await this.prisma.foundDocumentCase.findUnique({
      where: { id: foundCaseId },
      include: {
        case: {
          include: {
            document: { include: { type: true } },
            user: true,
            extraction: true,
          },
        },
      },
    });
    if (!foundCase) throw new NotFoundException('Found case not found');
    if (foundCase.status !== FoundDocumentCaseStatus.DRAFT) {
      throw new BadRequestException(
        `Exchange can only be scheduled for a ${FoundDocumentCaseStatus.DRAFT} case`,
      );
    }
    if (
      foundCase.case.extraction?.extractionStatus !== ExtractionStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'AI processing must be completed before scheduling an exchange',
      );
    }
    return foundCase;
  }

  // ─── User (finder) actions ────────────────────────────────────────────────

  async scheduleExchange(
    dto: ScheduleInboundExchangeDto,
    { user }: UserSession,
  ) {
    const foundCase = await this.getFoundCaseForExchange(dto.foundCaseId);

    if (foundCase.case.userId !== user.id) {
      throw new ForbiddenException(
        'Only the case owner can schedule an inbound exchange',
      );
    }

    const existing = await this.getActiveInboundExchange(dto.foundCaseId);
    if (existing) {
      throw new BadRequestException(
        'An active exchange already exists for this case. Cancel it before scheduling a new one.',
      );
    }

    return await this.prisma.documentExchange.create({
      data: {
        exchangeNumber: await this.humanId.generate({
          prefix: EntityPrefix.EXCHANGE,
        }),
        direction: ExchangeDirection.INBOUND,
        method: dto.method,
        status: ExchangeStatus.SCHEDULED,
        foundCaseId: dto.foundCaseId,
        stationId:
          dto.method === ExchangeMethod.STATION_DROPOFF
            ? (dto.stationId ?? null)
            : null,
        addressId:
          dto.method === ExchangeMethod.AGENT_PICKUP
            ? (dto.addressId ?? null)
            : null,
        scheduledAt: new Date(dto.scheduledAt),
        createdById: user.id,
      },
    });
  }

  async cancelExchange(
    foundCaseId: string,
    dto: CancelExchangeDto,
    user: UserSession['user'],
    checkOwnership = false,
  ) {
    const exchange = await this.getActiveInboundExchange(foundCaseId);
    if (!exchange)
      throw new NotFoundException('No active exchange found for this case');

    if (checkOwnership && exchange.foundCase.case.userId !== user.id) {
      throw new ForbiddenException(
        'Only the case owner can withdraw this exchange',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.exchangeVerification.updateMany({
        where: { exchangeId: exchange.id, status: VerificationStatus.PENDING },
        data: { status: VerificationStatus.CANCELLED, cancelledById: user.id },
      });
      await tx.documentExchange.update({
        where: { id: exchange.id },
        data: {
          status: ExchangeStatus.CANCELLED,
          cancelledById: user.id,
          cancelReason: dto.reason,
        },
      });
    });

    const caseOwner = exchange.foundCase.case.user;
    const caseNumber = exchange.foundCase.case.caseNumber;
    const caseId = exchange.foundCase.caseId;

    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.case.found.collection.cancelled',
        data: { case: { id: caseId, caseNumber } },
        userId: caseOwner.id,
        priority: NotificationPriority.NORMAL,
        eventTitle: 'Collection Cancelled',
        eventBody: `The collection for case #${caseNumber} was cancelled. Your case remains active.`,
        eventDescription: `Exchange ${exchange.id} cancelled by user ${user.id}. Reason: ${dto.reason}`,
      })
      .catch((e) =>
        this.logger.error(
          `Failed to send exchange cancellation notification for case ${foundCaseId}`,
          e,
        ),
      );

    return { message: 'Exchange cancelled successfully' };
  }

  // ─── Staff actions ─────────────────────────────────────────────────────────

  async issueVerification(
    foundCaseId: string,
    { user }: UserSession,
  ): Promise<IssueVerificationResponseDto> {
    const exchange = await this.getActiveInboundExchange(foundCaseId);
    if (!exchange)
      throw new NotFoundException(
        'No active scheduled exchange found for this case',
      );

    const ttlMinutes = await this.settings.get(
      'collection.code_ttl_minutes',
      z.coerce.number(),
      60,
    );
    const maxAttempts = await this.settings.get(
      'collection.max_attempts',
      z.coerce.number(),
      3,
    );

    await this.prisma.exchangeVerification.updateMany({
      where: { exchangeId: exchange.id, status: VerificationStatus.PENDING },
      data: { status: VerificationStatus.EXPIRED },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = dayjs().add(ttlMinutes, 'minute').toDate();

    const verification = await this.prisma.exchangeVerification.create({
      data: {
        exchangeId: exchange.id,
        code,
        expiresAt,
        maxAttempts,
        issuedById: user.id,
      },
    });

    if (exchange.status === ExchangeStatus.SCHEDULED) {
      await this.prisma.documentExchange.update({
        where: { id: exchange.id },
        data: { status: ExchangeStatus.IN_PROGRESS },
      });
    }

    const caseOwner = exchange.foundCase.case.user;
    const docTypeName =
      exchange.foundCase.case.document?.type?.name ?? 'document';
    const caseNumber = exchange.foundCase.case.caseNumber;
    const caseId = exchange.foundCase.caseId;

    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.case.found.collection.initiated',
        data: {
          case: {
            id: caseId,
            caseNumber,
            document: { type: { name: docTypeName } },
          },
          collection: { code, expiresAt },
        },
        userId: caseOwner.id,
        priority: NotificationPriority.HIGH,
        force: true,
        eventTitle: 'Handover Code Ready',
        eventBody: `Share code ${code} with the CitizenLink staff member serving you. Expires soon.`,
        eventDescription: `Verification issued for found case ${foundCaseId} by staff ${user.id}`,
      })
      .catch((e) =>
        this.logger.error(
          `Failed to send verification notification for case ${foundCaseId}`,
          e,
        ),
      );

    return {
      exchangeId: exchange.id,
      exchangeNumber: exchange.exchangeNumber,
      verificationId: verification.id,
      expiresAt,
    };
  }

  async cancelVerification(
    foundCaseId: string,
    dto: CancelVerificationDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.getActiveInboundExchange(foundCaseId);
    if (!exchange)
      throw new NotFoundException('No active exchange found for this case');

    const verification = exchange.verifications.find(
      (v) => v.status === VerificationStatus.PENDING,
    );
    if (!verification)
      throw new NotFoundException('No pending verification to cancel');

    await this.prisma.$transaction(async (tx) => {
      await tx.exchangeVerification.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.CANCELLED,
          cancelledById: user.id,
          cancelReason: dto.reason,
        },
      });
      await tx.documentExchange.update({
        where: { id: exchange.id },
        data: { status: ExchangeStatus.SCHEDULED },
      });
    });

    const caseOwner = exchange.foundCase.case.user;
    const caseNumber = exchange.foundCase.case.caseNumber;
    const caseId = exchange.foundCase.caseId;

    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.case.found.collection.cancelled',
        data: { case: { id: caseId, caseNumber } },
        userId: caseOwner.id,
        priority: NotificationPriority.NORMAL,
        eventTitle: 'Handover Session Ended',
        eventBody: `The handover session for case #${caseNumber} was ended by staff. Your exchange is still scheduled.`,
        eventDescription: `Verification ${verification.id} cancelled by staff ${user.id}. Reason: ${dto.reason}`,
      })
      .catch((e) =>
        this.logger.error(
          `Failed to send verification cancellation notification for case ${foundCaseId}`,
          e,
        ),
      );

    return { message: 'Verification cancelled. Exchange remains scheduled.' };
  }

  async verifyCode(
    foundCaseId: string,
    dto: VerifyExchangeCodeDto,
    { user, session }: UserSession,
  ) {
    const exchange = await this.getActiveInboundExchange(foundCaseId);
    if (!exchange)
      throw new NotFoundException('No active exchange found for this case');

    const verification = exchange.verifications.find(
      (v) => v.status === VerificationStatus.PENDING,
    );
    if (!verification)
      throw new NotFoundException('No pending verification for this exchange');

    if (dayjs().isAfter(verification.expiresAt)) {
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new GoneException(
        'Verification code has expired. Please re-issue a code.',
      );
    }

    if (verification.attempts >= verification.maxAttempts) {
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new HttpException(
        'Maximum code attempts reached. Please re-issue a code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (verification.code !== dto.code) {
      const newAttempts = verification.attempts + 1;
      const remaining = verification.maxAttempts - newAttempts;
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { attempts: newAttempts },
      });
      throw new BadRequestException(
        `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    const reason = await this.prisma.transitionReason.findUnique({
      where: {
        entityType_fromStatus_toStatus_code: {
          code: 'STAFF_CONFIRMED_COLLECTION',
          entityType: 'FoundDocumentCase',
          fromStatus: FoundDocumentCaseStatus.DRAFT,
          toStatus: FoundDocumentCaseStatus.SUBMITTED,
        },
      },
    });

    const updatedCase = await this.prisma.$transaction(async (tx) => {
      await tx.exchangeVerification.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.CONFIRMED,
          confirmedById: user.id,
          attempts: verification.attempts + 1,
        },
      });
      await tx.documentExchange.update({
        where: { id: exchange.id },
        data: {
          status: ExchangeStatus.COMPLETED,
          completedAt: new Date(),
          completedById: user.id,
        },
      });
      await tx.foundDocumentCase.update({
        where: { id: foundCaseId },
        data: {
          status: FoundDocumentCaseStatus.SUBMITTED,
          custodyStatus: CustodyStatus.IN_CUSTODY,
          currentStationId: session.stationId,
        },
      });
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus: FoundDocumentCaseStatus.DRAFT,
          toStatus: FoundDocumentCaseStatus.SUBMITTED,
          changedById: user.id,
          reasonId: reason?.id,
        },
      });
      return tx.documentCase.findUnique({
        where: { id: exchange.foundCase.caseId },
        include: {
          foundDocumentCase: true,
          lostDocumentCase: true,
          document: { include: { type: true, images: true } },
          address: true,
          extraction: true,
        },
      });
    });

    const caseOwner = exchange.foundCase.case.user;
    const docTypeName =
      exchange.foundCase.case.document?.type?.name ?? 'document';
    const caseNumber = exchange.foundCase.case.caseNumber;
    const caseId = exchange.foundCase.caseId;

    this.notifications
      .sendFromTemplate({
        templateKey: 'notification.case.found.submitted',
        data: {
          case: {
            id: caseId,
            caseNumber,
            document: { type: { name: docTypeName } },
          },
        },
        userId: caseOwner.id,
        priority: NotificationPriority.HIGH,
        eventTitle: 'Document Received',
        eventBody: `Your found ${docTypeName} (case #${caseNumber}) is now in Citizen Link's care. Thank you!`,
        eventDescription: `Found case ${foundCaseId} exchange verified by staff ${user.id}`,
      })
      .catch((e) =>
        this.logger.error(
          `Failed to send exchange confirmation notification for case ${foundCaseId}`,
          e,
        ),
      );

    return updatedCase;
  }

  // ─── Shared ────────────────────────────────────────────────────────────────

  private getActiveInboundExchange(foundCaseId: string) {
    return this.prisma.documentExchange.findFirst({
      where: {
        foundCaseId,
        direction: ExchangeDirection.INBOUND,
        status: { in: [ExchangeStatus.SCHEDULED, ExchangeStatus.IN_PROGRESS] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        verifications: { orderBy: { createdAt: 'desc' } },
        foundCase: {
          include: {
            case: {
              include: {
                document: { include: { type: true } },
                user: true,
              },
            },
          },
        },
      },
    });
  }

  async getActiveExchangeState(foundCaseId: string, user: UserSession['user']) {
    const exchange = await this.getActiveInboundExchange(foundCaseId);
    if (!exchange) return { hasActiveExchange: false as const };

    const pendingVerification = exchange.verifications.find(
      (v) => v.status === VerificationStatus.PENDING,
    );
    const isOwner = exchange.foundCase.case.userId === user.id;

    return {
      hasActiveExchange: true as const,
      exchangeId: exchange.id,
      exchangeNumber: exchange.exchangeNumber,
      status: exchange.status,
      method: exchange.method,
      stationId: exchange.stationId,
      addressId: exchange.addressId,
      scheduledAt: exchange.scheduledAt,
      expiresAt: pendingVerification?.expiresAt,
      attempts: pendingVerification?.attempts,
      maxAttempts: pendingVerification?.maxAttempts,
      code: isOwner ? pendingVerification?.code : undefined,
    };
  }
}
