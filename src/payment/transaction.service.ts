/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentProvider,
  Prisma,
  TransactionStatus,
  WalletEntryReason,
  WalletEntryType,
} from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { PrismaService } from '../prisma/prisma.service';
import { isSuperUser, parseDate } from '../app.utils';
import { DarajaService, StkCallbackBody } from './daraja.service';
import { InitiatePaymentDto, QueryTransactionDto } from './transaction.dto';
import { NotificationDispatchService } from '../notifications/notifications.dispatch.service';
import { NotificationPriority } from '../notifications/notification.interfaces';
import { RegionService } from '../region/region.service';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly humanIdService: HumanIdService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly darajaService: DarajaService,
    private readonly notificationService: NotificationDispatchService,
    private readonly regionService: RegionService,
  ) {}

  /**
   * Initiate an STK push payment against an invoice.
   * - Staff/agent: can trigger for any invoice; sets initiatedById.
   * - Client: can only trigger for their own invoice.
   */
  async initiatePayment(
    dto: InitiatePaymentDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const isAgent = isSuperUser(user);

    // Fetch invoice with claim + claimant phone separately to keep types clean
    const invoice = await this.prismaService.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        claim: {
          include: {
            user: { select: { id: true, phoneNumber: true } },
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    // Access control: non-agents can only pay their own invoice
    if (!isAgent && invoice.claim.userId !== user.id) {
      throw new NotFoundException('Invoice not found');
    }

    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Invoice is already ${invoice.status.toLowerCase()}`,
      );
    }

    const balanceDue = invoice.balanceDue.toNumber();
    if (balanceDue <= 0) {
      throw new BadRequestException('Invoice has no outstanding balance');
    }

    const amount = dto.amount ?? balanceDue;
    if (amount > balanceDue) {
      throw new BadRequestException(
        `Amount (${amount}) exceeds balance due (${balanceDue})`,
      );
    }

    // Resolve phone number: DTO override → claimant's phone on file
    const rawPhone =
      dto.phoneNumber ?? invoice.claim.user.phoneNumber ?? undefined;
    if (!rawPhone) {
      throw new BadRequestException(
        'No phone number available for STK push. Please provide phoneNumber in the request.',
      );
    }
    // Normalise to 2547XXXXXXXX (strip leading + or 0)
    const phone = rawPhone.replace(/^\+/, '').replace(/^0/, '254');

    // Create the Transaction in PENDING state before calling Daraja.
    // This ensures we have a record even if Daraja fails, and prevents re-entry.
    const transaction = await this.prismaService.transaction.create({
      data: {
        transactionNumber: await this.humanIdService.generate({
          prefix: EntityPrefix.TRANSACTION,
        }),
        userId: invoice.claim.userId,
        initiatedById: isAgent ? user.id : null,
        invoiceId: invoice.id,
        amount,
        currency: this.regionService.getCurrency(),
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        paymentProvider: PaymentProvider.MPESA,
        status: TransactionStatus.PENDING,
      },
    });

    // Call Daraja — if it fails, mark the transaction FAILED so the UI gets a clear error
    try {
      const stkResponse = await this.darajaService.initiateStkPush({
        phoneNumber: phone,
        amount,
        accountRef: invoice.invoiceNumber,
        description: `Payment for invoice ${invoice.invoiceNumber}`,
      });

      // Advance to PROCESSING and store CheckoutRequestID for callback matching
      return await this.prismaService.transaction.update({
        where: { id: transaction.id },
        data: {
          checkoutRequestId: stkResponse.CheckoutRequestID,
          status: TransactionStatus.PROCESSING,
          metadata: {
            merchantRequestId: stkResponse.MerchantRequestID,
            customerMessage: stkResponse.CustomerMessage,
          },
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } catch (err) {
      await this.prismaService.transaction.update({
        where: { id: transaction.id },
        data: { status: TransactionStatus.FAILED },
      });
      throw err;
    }
  }

  /**
   * Daraja STK push callback handler.
   * No authentication — Daraja posts to this URL directly.
   * Matched by CheckoutRequestID.
   */
  async handleDarajaCallback(body: StkCallbackBody) {
    const { CheckoutRequestID, ResultCode, ResultDesc } = body.Body.stkCallback;

    const transaction = await this.prismaService.transaction.findUnique({
      where: { checkoutRequestId: CheckoutRequestID },
      include: { invoice: true },
    });

    if (!transaction) {
      this.logger.warn(
        `Callback for unknown CheckoutRequestID: ${CheckoutRequestID}`,
      );
      return; // Daraja expects 200 regardless
    }

    if (transaction.status === TransactionStatus.COMPLETED) {
      this.logger.warn(
        `Duplicate callback for already-completed transaction ${transaction.id}`,
      );
      return;
    }

    const success = ResultCode === 0;

    if (!success) {
      this.logger.warn(
        `STK push failed — ${ResultDesc} (txn ${transaction.id})`,
      );
      await this.prismaService.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          metadata: {
            ...(transaction.metadata as object),
            resultDesc: ResultDesc,
            resultCode: ResultCode,
          },
        },
      });
      return;
    }

    const receiptNumber = this.darajaService.extractReceiptNumber(body);
    const invoice = transaction.invoice;
    const paidAmount = transaction.amount.toNumber();
    const newAmountPaid = invoice.amountPaid.toNumber() + paidAmount;
    const newBalanceDue = Math.max(
      0,
      invoice.totalAmount.toNumber() - newAmountPaid,
    );
    const newStatus =
      newBalanceDue === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    // Captured inside $transaction for post-commit notification.
    // Wrapped in an object so TypeScript tracks the property mutation across
    // the async closure (bare `let` mutations in closures don't narrow correctly).
    const rewardCtx: {
      notification: {
        finderId: string;
        disbursementNumber: string;
        disbursementId: string;
        amount: number;
      } | null;
    } = { notification: null };

    await this.prismaService.$transaction(async (tx) => {
      // Complete the transaction record
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          providerTransactionId: receiptNumber,
          metadata: {
            ...(transaction.metadata as object),
            resultDesc: ResultDesc,
            resultCode: ResultCode,
          },
        },
      });

      // Update invoice amountPaid + balanceDue atomically
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
        },
      });

      // When invoice is fully paid, auto-create a disbursement for the finder
      if (newStatus === InvoiceStatus.PAID) {
        const finderReward = invoice.finderReward.toNumber();
        if (finderReward > 0) {
          const fullInvoice = await tx.invoice.findUnique({
            where: { id: invoice.id },
            include: {
              claim: {
                include: {
                  match: {
                    include: {
                      foundDocumentCase: {
                        include: { case: { select: { userId: true } } },
                      },
                    },
                  },
                },
              },
            },
          });
          const finderId =
            fullInvoice?.claim.match.foundDocumentCase.case.userId;

          if (finderId) {
            const disbursement = await tx.disbursement.create({
              data: {
                disbursementNumber: await this.humanIdService.generate({
                  prefix: EntityPrefix.DISBURSEMENT,
                }),
                invoiceId: invoice.id,
                recipientId: finderId,
                amount: finderReward,
                currency: this.regionService.getCurrency(),
                paymentMethod: PaymentMethod.MOBILE_MONEY,
                paymentProvider: PaymentProvider.MPESA,
              },
            });
            this.logger.log(
              `Disbursement created for finder ${finderId} — ${this.regionService.getCurrency()} ${finderReward}`,
            );

            // Upsert wallet and record a CREDIT ledger entry atomically
            const wallet = await tx.wallet.upsert({
              where: { userId: finderId },
              create: { userId: finderId, balance: finderReward },
              update: { balance: { increment: finderReward } },
            });
            const balanceBefore = wallet.balance.toNumber();
            await tx.walletLedger.create({
              data: {
                walletId: wallet.id,
                type: WalletEntryType.CREDIT,
                reason: WalletEntryReason.FINDER_REWARD,
                amount: finderReward,
                balanceBefore,
                balanceAfter: balanceBefore + finderReward,
                referenceType: 'Disbursement',
                referenceId: disbursement.id,
                description: `Finder reward for disbursement ${disbursement.disbursementNumber}`,
              },
            });

            // Capture for post-transaction notification (cannot send inside $transaction)
            rewardCtx.notification = {
              finderId,
              disbursementNumber: disbursement.disbursementNumber,
              disbursementId: disbursement.id,
              amount: finderReward,
            };
          }
        }
      }
    });

    this.logger.log(
      `Payment confirmed — txn ${transaction.transactionNumber}, receipt ${receiptNumber ?? 'N/A'}, invoice now ${newStatus}`,
    );

    // Send reward-ready notification to finder (outside $transaction — cannot enqueue inside)
    if (rewardCtx.notification) {
      const { finderId, disbursementNumber, disbursementId, amount } =
        rewardCtx.notification;
      await this.notificationService.sendFromTemplate({
        templateKey: 'notification.disbursement.reward_ready',
        data: { disbursementNumber, disbursementId, amount },
        userId: finderId,
        priority: NotificationPriority.NORMAL,
        eventTitle: 'Reward Ready to Withdraw',
        eventBody: `Your finder reward of ${this.regionService.getCurrency()} ${amount} is ready to withdraw.`,
        eventDescription: `Disbursement ${disbursementNumber} created for finder ${finderId}`,
      });
    }
  }

  async findAll(
    query: QueryTransactionDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: Prisma.TransactionWhereInput = {
      AND: [
        {
          invoiceId: query.invoiceId,
          status: query.status,
          paymentProvider: query.paymentProvider,
          userId: isAdmin ? query.userId : user.id,
          createdAt: {
            gte: parseDate(query.createdAtFrom),
            lte: parseDate(query.createdAtTo),
          },
        },
      ],
    };

    const totalCount = await this.prismaService.transaction.count({
      where: dbQuery,
    });

    const data = await this.prismaService.transaction.findMany({
      where: dbQuery,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
      ...this.sortService.buildSortQuery(query?.orderBy),
    });

    return {
      results: data,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id, userId: isAdmin ? undefined : user.id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }
}
