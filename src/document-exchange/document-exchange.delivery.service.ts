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
import {
  CustodyStatus,
  ExchangeMethod,
  ExchangeStatus,
  FoundDocumentCaseStatus,
  LostDocumentCaseStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentExchangePolicyService } from './document-exchange.policy.service';

@Injectable()
export class DocumentExchangeDeliveryService {
  private readonly logger = new Logger(DocumentExchangeDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
    private readonly policy: DocumentExchangePolicyService,
  ) {}

  /**
   * Owner confirms receipt of their document by entering the code printed on the package label.
   * This is the recipient-side confirmation for COURIER_DELIVERY exchanges.
   */
  async confirmDelivery(code: string, user: UserSession['user']) {
    const verification = await this.prisma.exchangeVerification.findFirst({
      where: { code, status: VerificationStatus.PENDING },
      include: {
        exchange: {
          include: {
            claim: {
              include: {
                user: true,
                match: true,
              },
            },
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
        },
      },
    });

    if (!verification) {
      throw new NotFoundException(
        'Invalid or already-used confirmation code. Please check the code on your package label.',
      );
    }

    const exchange = verification.exchange;

    if (exchange.method !== ExchangeMethod.COURIER_DELIVERY) {
      throw new BadRequestException(
        'This endpoint is for courier delivery confirmations only.',
      );
    }

    if (exchange.claim?.userId !== user.id) {
      throw new ForbiddenException(
        'You can only confirm receipt of your own document.',
      );
    }

    if (dayjs().isAfter(verification.expiresAt)) {
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new GoneException(
        'The confirmation code on your label has expired. Please contact the station to reissue the label.',
      );
    }

    if (verification.attempts >= verification.maxAttempts) {
      await this.prisma.exchangeVerification.update({
        where: { id: verification.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      throw new HttpException(
        'Maximum confirmation attempts reached. Please contact the station.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Pre-fetch lost case context outside the transaction
    const lostDocumentCaseId =
      exchange.claim?.match?.lostDocumentCaseId ?? null;
    let lostCaseCurrentStatus: LostDocumentCaseStatus | null = null;
    let lostTransitionReason: { id: string } | null = null;

    if (lostDocumentCaseId) {
      const lostCase = await this.prisma.lostDocumentCase.findUnique({
        where: { id: lostDocumentCaseId },
        select: { status: true },
      });
      lostCaseCurrentStatus = lostCase?.status ?? null;
      if (lostCaseCurrentStatus) {
        lostTransitionReason = await this.prisma.transitionReason.findUnique({
          where: {
            entityType_fromStatus_toStatus_code: {
              code: 'DOCUMENT_REUNITED_WITH_OWNER',
              entityType: 'LostDocumentCase',
              fromStatus: lostCaseCurrentStatus,
              toStatus: LostDocumentCaseStatus.COMPLETED,
            },
          },
        });
      }
    }

    const completionReason = await this.prisma.transitionReason.findUnique({
      where: {
        entityType_fromStatus_toStatus_code: {
          code: 'STAFF_CONFIRMED_HANDOVER',
          entityType: 'FoundDocumentCase',
          fromStatus: FoundDocumentCaseStatus.VERIFIED,
          toStatus: FoundDocumentCaseStatus.COMPLETED,
        },
      },
    });

    const foundCaseId = exchange.foundCaseId;

    await this.prisma.$transaction(async (tx) => {
      await tx.exchangeVerification.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.CONFIRMED,
          confirmedById: user.id,
          attempts: { increment: 1 },
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
          status: FoundDocumentCaseStatus.COMPLETED,
          custodyStatus: CustodyStatus.HANDED_OVER,
          currentStationId: null,
        },
      });
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus: FoundDocumentCaseStatus.VERIFIED,
          toStatus: FoundDocumentCaseStatus.COMPLETED,
          changedById: user.id,
          reasonId: completionReason?.id,
        },
      });
      if (lostDocumentCaseId && lostCaseCurrentStatus) {
        await tx.lostDocumentCase.update({
          where: { id: lostDocumentCaseId },
          data: { status: LostDocumentCaseStatus.COMPLETED },
        });
        await tx.statusTransition.create({
          data: {
            entityType: 'LostDocumentCase',
            entityId: lostDocumentCaseId,
            fromStatus: lostCaseCurrentStatus,
            toStatus: LostDocumentCaseStatus.COMPLETED,
            changedById: user.id,
            reasonId: lostTransitionReason?.id,
          },
        });
      }
    });

    const claimant = exchange.claim?.user;
    const docTypeName =
      exchange.foundCase.case.document?.type?.name ?? 'document';
    const claimNumber = exchange.claim?.claimNumber ?? exchange.exchangeNumber;

    if (claimant) {
      this.notifications
        .sendFromTemplate({
          templateKey: 'notification.case.found.delivery.confirmed',
          data: {
            exchange: {
              exchangeNumber: exchange.exchangeNumber,
              claim: { id: exchange.claimId, claimNumber },
              document: { type: { name: docTypeName } },
            },
          },
          userId: claimant.id,
          priority: NotificationPriority.HIGH,
          eventTitle: 'Document Received',
          eventBody: `Your ${docTypeName} has been delivered and confirmed. Your case is now complete.`,
          eventDescription: `Courier delivery confirmed by owner ${user.id} for exchange ${exchange.id}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send delivery confirmation notification for exchange ${exchange.id}`,
            e,
          ),
        );
    }

    return { success: true, exchangeNumber: exchange.exchangeNumber };
  }

  /**
   * Staff marks a courier delivery as failed (e.g. recipient not home, wrong address).
   */
  async failDelivery(
    exchangeNumber: string,
    reason: string,
    user: UserSession['user'],
  ) {
    const exchange = await this.prisma.documentExchange.findUnique({
      where: { exchangeNumber },
      include: {
        claim: { include: { user: true } },
        foundCase: {
          include: {
            case: { include: { document: { include: { type: true } } } },
          },
        },
      },
    });

    if (!exchange) throw new NotFoundException('Exchange not found');
    if (exchange.method !== ExchangeMethod.COURIER_DELIVERY) {
      throw new BadRequestException(
        'Only COURIER_DELIVERY exchanges can be marked as failed.',
      );
    }
    if (exchange.status !== ExchangeStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Only IN_PROGRESS exchanges can be marked as failed.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.exchangeVerification.updateMany({
        where: { exchangeId: exchange.id, status: VerificationStatus.PENDING },
        data: { status: VerificationStatus.EXPIRED },
      });
      await tx.documentExchange.update({
        where: { id: exchange.id },
        data: {
          status: ExchangeStatus.FAILED,
          cancelledById: user.id,
          cancelReason: reason,
        },
      });
    });

    const claimant = exchange.claim?.user;
    if (claimant) {
      const maxAttempts = await this.policy.getMaxAttempts();
      const failedCount = await this.prisma.documentExchange.count({
        where: {
          claimId: exchange.claimId,
          method: ExchangeMethod.COURIER_DELIVERY,
          status: ExchangeStatus.FAILED,
        },
      });

      const docTypeName =
        exchange.foundCase.case.document?.type?.name ?? 'document';
      const claimNumber = exchange.claim?.claimNumber ?? exchange.exchangeNumber;
      const attemptsLeft = maxAttempts - failedCount;
      const isMaxReached = failedCount >= maxAttempts;

      this.notifications
        .sendFromTemplate({
          templateKey: 'notification.case.found.delivery.failed',
          data: {
            exchange: {
              exchangeNumber: exchange.exchangeNumber,
              claim: { id: exchange.claimId, claimNumber },
              document: { type: { name: docTypeName } },
              reason,
              attemptsLeft: isMaxReached ? 0 : attemptsLeft,
              isMaxReached,
            },
          },
          userId: claimant.id,
          priority: NotificationPriority.NORMAL,
          eventTitle: 'Delivery Attempt Failed',
          eventBody: isMaxReached
            ? `Delivery of your ${docTypeName} failed (${reason}). Maximum attempts reached — please collect in person at a station.`
            : `Delivery of your ${docTypeName} failed (${reason}). You have ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
          eventDescription: `Courier delivery ${exchange.id} marked failed by staff ${user.id}. Reason: ${reason}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send delivery-failed notification for exchange ${exchange.id}`,
            e,
          ),
        );
    }

    return { success: true, exchangeNumber };
  }
}
