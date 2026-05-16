import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ExchangeDirection,
  ExchangeStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelExchangeDto,
  WithdrawScheduleQueryDto,
} from './document-exchange.dto';
import { DocumentExchangeQueryService } from './document-exchange.query.service';

@Injectable()
export class DocumentExchangeWithdrawService {
  private readonly logger = new Logger(DocumentExchangeWithdrawService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
    private readonly query: DocumentExchangeQueryService,
  ) {}

  async withDraw(
    exchangeQuery: WithdrawScheduleQueryDto,
    dto: CancelExchangeDto,
    user: UserSession['user'],
  ) {
    const exchange = await this.query.getActiveExchange(exchangeQuery);
    if (!exchange) throw new NotFoundException('No active exchange found');

    if (
      exchangeQuery.direction === ExchangeDirection.INBOUND &&
      exchange.foundCase.case.userId !== user.id
    ) {
      throw new ForbiddenException(
        'Only the case owner can withdraw this exchange',
      );
    }
    if (
      exchangeQuery.direction === ExchangeDirection.OUTBOUND &&
      exchange.claim?.userId !== user.id
    ) {
      throw new ForbiddenException(
        'Only the claimant can withdraw this exchange',
      );
    }

    await this.prisma.documentExchange.update({
      where: { id: exchange.id },
      data: {
        status: ExchangeStatus.CANCELLED,
        cancelledById: user.id,
        cancelReason: dto.reason,
        verifications: {
          updateMany: {
            where: {
              exchangeId: exchange.id,
              status: VerificationStatus.PENDING,
            },
            data: {
              status: VerificationStatus.CANCELLED,
              cancelledById: user.id,
            },
          },
        },
      },
    });

    if (exchangeQuery.direction === ExchangeDirection.INBOUND) {
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
            `Failed to send withdrawal notification for case ${exchangeQuery.foundCaseId}`,
            e,
          ),
        );
    }
    // TODO: decide whether to notify claimant on outbound withdrawal

    return this.query.findOne(
      exchange.id,
      exchangeQuery as CustomRepresentationQueryDto,
      user,
    );
  }
}
