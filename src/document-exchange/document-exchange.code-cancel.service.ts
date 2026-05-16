import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ExchangeDirection,
  ExchangeStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelCodeQueryDto,
  CancelVerificationDto,
} from './document-exchange.dto';
import { DocumentExchangeQueryService } from './document-exchange.query.service';

@Injectable()
export class DocumentExchangeCodeCancelService {
  private readonly logger = new Logger(DocumentExchangeCodeCancelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
    private readonly query: DocumentExchangeQueryService,
  ) {}

  async cancelCode(
    exchangeQuery: CancelCodeQueryDto,
    dto: CancelVerificationDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.query.getActiveExchange(exchangeQuery);
    if (!exchange)
      throw new NotFoundException('No active scheduled exchange found');

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

    if (exchange.direction === ExchangeDirection.INBOUND) {
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
            `Failed to send code-cancel notification for case ${exchange.foundCaseId}`,
            e,
          ),
        );
    }

    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const claimant = exchange.claim?.user;
      if (claimant) {
        const claimNumber =
          exchange.claim?.claimNumber ?? exchange.exchangeNumber;
        const claimId = exchange.claimId;
        this.notifications
          .sendFromTemplate({
            templateKey: 'notification.handover.code.cancelled',
            data: {
              handover: {
                exchangeNumber: exchange.exchangeNumber,
                claim: { id: claimId, claimNumber },
              },
            },
            userId: claimant.id,
            priority: NotificationPriority.NORMAL,
            eventTitle: 'Collection Code Cancelled',
            eventBody: `Your collection code for claim #${claimNumber} was cancelled. Your appointment remains scheduled.`,
            eventDescription: `Outbound verification ${verification.id} cancelled by staff ${user.id}. Reason: ${dto.reason}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send outbound code-cancel notification for exchange ${exchange.id}`,
              e,
            ),
          );
      }
    }

    return this.query.findOne(exchange.id, exchangeQuery, user);
  }
}
