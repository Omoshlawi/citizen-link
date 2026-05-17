import {
  BadRequestException,
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
  ExchangeDirection,
  ExchangeStatus,
  FoundDocumentCaseStatus,
  InvoiceItemType,
  LostDocumentCaseStatus,
  PaymentMethod,
  PaymentProvider,
  VerificationStatus,
  WalletEntryReason,
  WalletEntryType,
} from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { UserSession } from '../auth/auth.types';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegionService } from '../region/region.service';
import {
  VerifyCodeQueryDto,
  VerifyExchangeCodeDto,
} from './document-exchange.dto';
import { DocumentExchangeQueryService } from './document-exchange.query.service';

@Injectable()
export class DocumentExchangeCodeVerifyService {
  private readonly logger = new Logger(DocumentExchangeCodeVerifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
    private readonly humanId: HumanIdService,
    private readonly region: RegionService,
    private readonly query: DocumentExchangeQueryService,
  ) {}

  async verifyCode(
    exchangeQuery: VerifyCodeQueryDto,
    dto: VerifyExchangeCodeDto,
    { user, session }: UserSession,
  ) {
    const exchange = await this.query.getActiveExchange(exchangeQuery);
    if (!exchange)
      throw new NotFoundException('No active scheduled exchange found');

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

    const reason =
      exchange.direction === ExchangeDirection.INBOUND
        ? await this.prisma.transitionReason.findUnique({
            where: {
              entityType_fromStatus_toStatus_code: {
                code: 'STAFF_CONFIRMED_COLLECTION',
                entityType: 'FoundDocumentCase',
                fromStatus: FoundDocumentCaseStatus.DRAFT,
                toStatus: FoundDocumentCaseStatus.SUBMITTED,
              },
            },
          })
        : await this.prisma.transitionReason.findUnique({
            where: {
              entityType_fromStatus_toStatus_code: {
                code: 'STAFF_CONFIRMED_HANDOVER',
                entityType: 'FoundDocumentCase',
                fromStatus: FoundDocumentCaseStatus.VERIFIED,
                toStatus: FoundDocumentCaseStatus.COMPLETED,
              },
            },
          });

    // Pre-fetch lost case state for OUTBOUND — must run outside the transaction
    const lostDocumentCaseId =
      exchange.direction === ExchangeDirection.OUTBOUND
        ? (exchange.claim?.match?.lostDocumentCaseId ?? null)
        : null;
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

    const foundCaseId = exchange.foundCaseId;
    let rewardCtx: {
      finderId: string;
      disbursementNumber: string;
      amount: number;
    } | null = null;

    await this.prisma.$transaction(async (tx) => {
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
          status:
            exchange.direction === ExchangeDirection.INBOUND
              ? FoundDocumentCaseStatus.SUBMITTED
              : FoundDocumentCaseStatus.COMPLETED,
          custodyStatus:
            exchange.direction === ExchangeDirection.INBOUND
              ? CustodyStatus.IN_CUSTODY
              : CustodyStatus.HANDED_OVER,
          currentStationId:
            exchange.direction === ExchangeDirection.INBOUND
              ? session.stationId
              : null,
        },
      });
      await tx.statusTransition.create({
        data: {
          entityType: 'FoundDocumentCase',
          entityId: foundCaseId,
          fromStatus:
            exchange.direction === ExchangeDirection.INBOUND
              ? FoundDocumentCaseStatus.DRAFT
              : FoundDocumentCaseStatus.VERIFIED,
          toStatus:
            exchange.direction === ExchangeDirection.INBOUND
              ? FoundDocumentCaseStatus.SUBMITTED
              : FoundDocumentCaseStatus.COMPLETED,
          changedById: user.id,
          reasonId: reason?.id,
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

      // OUTBOUND only: disburse finder reward now that physical handover is confirmed
      if (
        exchange.direction === ExchangeDirection.OUTBOUND &&
        exchange.claimId
      ) {
        const claim = await tx.claim.findUnique({
          where: { id: exchange.claimId },
          include: {
            invoice: { include: { items: true } },
            match: {
              include: {
                foundDocumentCase: {
                  include: { case: { select: { userId: true } } },
                },
              },
            },
          },
        });

        const finderReward = (claim?.invoice?.items ?? [])
          .filter((item) => item.type === InvoiceItemType.FINDER_REWARD)
          .reduce((sum, item) => sum.plus(item.amount), new Decimal(0));

        const finderId = claim?.match?.foundDocumentCase?.case?.userId;

        if (finderId && finderReward.greaterThan(0) && claim?.invoice) {
          const disbursement = await tx.disbursement.create({
            data: {
              disbursementNumber: await this.humanId.generate({
                prefix: EntityPrefix.DISBURSEMENT,
              }),
              invoiceId: claim.invoice.id,
              recipientId: finderId,
              amount: finderReward,
              currency: this.region.getCurrency(),
              paymentMethod: PaymentMethod.MOBILE_MONEY,
              paymentProvider: PaymentProvider.MPESA,
            },
          });

          const wallet = await tx.wallet.upsert({
            where: { userId: finderId },
            create: {
              userId: finderId,
              balance: finderReward,
              currency: this.region.getCurrency(),
            },
            update: { balance: { increment: finderReward } },
          });
          await tx.walletLedger.create({
            data: {
              walletId: wallet.id,
              type: WalletEntryType.CREDIT,
              reason: WalletEntryReason.FINDER_REWARD,
              amount: finderReward,
              currency: this.region.getCurrency(),
              balanceBefore: wallet.balance.minus(finderReward),
              balanceAfter: wallet.balance,
              referenceType: 'Disbursement',
              referenceId: disbursement.id,
              description: `Finder reward for disbursement ${disbursement.disbursementNumber}`,
            },
          });

          rewardCtx = {
            finderId,
            disbursementNumber: disbursement.disbursementNumber,
            amount: finderReward.toNumber(),
          };
        }
      }
    });

    this.sendCompletionNotifications(exchange, foundCaseId, rewardCtx, user.id);

    return this.query.findOne(exchange.id, exchangeQuery, user);
  }

  private sendCompletionNotifications(
    exchange: Awaited<
      ReturnType<DocumentExchangeQueryService['getActiveExchange']>
    >,
    foundCaseId: string,
    rewardCtx: {
      finderId: string;
      disbursementNumber: string;
      amount: number;
    } | null,
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
          eventDescription: `Found case ${foundCaseId} exchange verified by staff ${staffId}`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send inbound completion notification for case ${foundCaseId}`,
            e,
          ),
        );
    }

    if (exchange.direction === ExchangeDirection.OUTBOUND) {
      const claimant = exchange.claim?.user;
      if (claimant) {
        const docTypeName =
          exchange.foundCase.case.document?.type?.name ?? 'document';
        const claimNumber =
          exchange.claim?.claimNumber ?? exchange.exchangeNumber;
        const claimId = exchange.claimId;
        this.notifications
          .sendFromTemplate({
            templateKey: 'notification.handover.completed',
            data: {
              handover: {
                exchangeNumber: exchange.exchangeNumber,
                claim: { id: claimId, claimNumber },
                document: { type: { name: docTypeName } },
              },
            },
            userId: claimant.id,
            priority: NotificationPriority.HIGH,
            eventTitle: 'Document Collected Successfully',
            eventBody: `Your ${docTypeName} has been handed over. Case complete.`,
            eventDescription: `Outbound exchange ${exchange.id} completed by staff ${staffId}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to send outbound completion notification for exchange ${exchange.id}`,
              e,
            ),
          );
      }
    }

    if (rewardCtx) {
      const { finderId, disbursementNumber, amount } = rewardCtx;
      this.notifications
        .sendFromTemplate({
          templateKey: 'notification.disbursement.reward_ready',
          data: { disbursementNumber, amount },
          userId: finderId,
          priority: NotificationPriority.NORMAL,
          eventTitle: 'Reward Ready to Withdraw',
          eventBody: `Your finder reward of ${this.region.getCurrency()} ${amount} is ready to withdraw.`,
          eventDescription: `Disbursement ${disbursementNumber} created on handover confirmation`,
        })
        .catch((e) =>
          this.logger.error(
            `Failed to send reward-ready notification to finder ${finderId}`,
            e,
          ),
        );
    }
  }
}
