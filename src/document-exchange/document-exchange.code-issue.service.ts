import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import {
  ExchangeDirection,
  ExchangeStatus,
  InvoiceStatus,
  VerificationStatus,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import { SystemSettingService } from '../common/settings/settings.system.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { IssueCodeQueryDto } from './document-exchange.dto';
import { DocumentExchangeQueryService } from './document-exchange.query.service';
import z from 'zod';

@Injectable()
export class DocumentExchangeCodeIssueService {
  private readonly logger = new Logger(DocumentExchangeCodeIssueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
    private readonly settings: SystemSettingService,
    private readonly query: DocumentExchangeQueryService,
  ) {}

  async issueCode(exchangeQuery: IssueCodeQueryDto, user: UserSession['user']) {
    const exchange = await this.query.getActiveExchange(exchangeQuery);
    if (!exchange)
      throw new NotFoundException('No active scheduled exchange found');

    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const invoice = exchange.claim?.invoice;
      if (!invoice || invoice.status !== InvoiceStatus.PAID) {
        throw new HttpException(
          'Payment must be completed before the collection code can be issued.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const [ttlMinutes, maxAttempts] = await Promise.all([
      this.settings.get('collection.code_ttl_minutes', z.coerce.number(), 60),
      this.settings.get('collection.max_attempts', z.coerce.number(), 3),
    ]);

    // Expire any previously issued code for this exchange
    await this.prisma.exchangeVerification.updateMany({
      where: { exchangeId: exchange.id, status: VerificationStatus.PENDING },
      data: { status: VerificationStatus.EXPIRED },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = dayjs().add(ttlMinutes, 'minute').toDate();

    await this.prisma.exchangeVerification.create({
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

    this.sendCodeNotification(exchange, code, expiresAt, user.id);

    return this.query.findOne(exchange.id, exchangeQuery, user);
  }

  private sendCodeNotification(
    exchange: Awaited<
      ReturnType<DocumentExchangeQueryService['getActiveExchange']>
    >,
    code: string,
    expiresAt: Date,
    staffId: string,
  ) {
    if (!exchange) return;

    if (exchange.direction === ExchangeDirection.INBOUND) {
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
          eventDescription: `Verification issued for found case ${exchange.foundCaseId} by staff ${staffId}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send inbound code notification for case ${exchange.foundCaseId}`,
            e,
          ),
        );
      return;
    }

    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const claimant = exchange.claim?.user;
      if (!claimant) return;

      const claimNumber =
        exchange.claim?.claimNumber ?? exchange.exchangeNumber;
      const claimId = exchange.claimId;

      if (exchange.method === 'COURIER_DELIVERY') {
        const docTypeName =
          exchange.foundCase.case.document?.type?.name ?? 'document';
        this.notifications
          .sendFromTemplate({
            templateKey: 'notification.handover.dispatched',
            data: {
              handover: {
                exchangeNumber: exchange.exchangeNumber,
                claim: { id: claimId, claimNumber },
                document: { type: { name: docTypeName } },
              },
            },
            userId: claimant.id,
            priority: NotificationPriority.HIGH,
            force: true,
            eventTitle: 'Your Document Is On Its Way',
            eventBody: `Your ${docTypeName} has been dispatched. The confirmation code is printed on the package label — use it to confirm receipt when delivered.`,
            eventDescription: `Courier delivery dispatched for claim ${claimId} by staff ${staffId}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send courier dispatch notification for exchange ${exchange.id}`,
              e,
            ),
          );
      } else {
        this.notifications
          .sendFromTemplate({
            templateKey: 'notification.handover.code.issued',
            data: {
              handover: {
                exchangeNumber: exchange.exchangeNumber,
                claim: { id: claimId, claimNumber },
                collection: { code, expiresAt },
              },
            },
            userId: claimant.id,
            priority: NotificationPriority.HIGH,
            force: true,
            eventTitle: 'Your Collection Code is Ready',
            eventBody: `Show code ${code} to the CitizenLink agent to collect your document.`,
            eventDescription: `Outbound verification issued for claim ${claimId} by staff ${staffId}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send outbound code notification for exchange ${exchange.id}`,
              e,
            ),
          );
      }
    }
  }
}
