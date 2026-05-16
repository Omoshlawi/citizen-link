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
} from '../../generated/prisma/client';
import { BetterAuthWithPlugins, UserSession } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { EntityPrefix } from '../human-id/human-id.constants';
import { HumanIdService } from '../human-id/human-id.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseDate } from '../app.utils';
import { DarajaService } from '../daraja/daraja.service';
import { StkCallbackBodyDto } from '../daraja/daraja.dto';
import { InitiatePaymentDto, QueryTransactionDto } from './transaction.dto';
import { Decimal } from '@prisma/client/runtime/client';
import { RegionService } from '../region/region.service';
import { MauzoService } from 'src/mauzo/mauzo.service';

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
    private readonly regionService: RegionService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private readonly mauzoService: MauzoService,
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
    const { success: isAgent } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { transaction: ['list-any'] } },
    });

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
    if (
      dto.phoneNumber &&
      !this.regionService.getSubscriberRegex().test(dto.phoneNumber)
    ) {
      throw new BadRequestException(
        `Phone number must be subscriber digits only, e.g. ${this.regionService.getSubscriberExample()}`,
      );
    }
    const phone = this.regionService.toDarajaPhone(rawPhone);

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
      // const stkResponse = await this.darajaService.initiateStkPush({
      //   phoneNumber: phone,
      //   amount,
      //   accountRef: invoice.invoiceNumber,
      //   description: `Payment for invoice ${invoice.invoiceNumber}`,
      // });
      const stkResponse = await this.mauzoService.initiatePayment({
        phone_number: phone,
        amount,
        description: `Payment for invoice ${invoice.invoiceNumber}`,
        currency: 'KES', // TODO: Use regional configured payment
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: invoice.id,
        },
      });

      // Advance to PROCESSING and store CheckoutRequestID for callback matching
      return await this.prismaService.transaction.update({
        where: { id: transaction.id },
        data: {
          // Daraja
          // checkoutRequestId: stkResponse.CheckoutRequestID,
          // status: TransactionStatus.PROCESSING,
          // metadata: {
          //   merchantRequestId: stkResponse.MerchantRequestID,
          //   customerMessage: stkResponse.CustomerMessage,
          // },
          // mauzo
          checkoutRequestId: stkResponse.id,
          status: TransactionStatus.PROCESSING,
          metadata: {
            // merchantRequestId: stkResponse.,
            // customerMessage: stkResponse.CustomerMessage,
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
  async handleDarajaCallback(body: StkCallbackBodyDto) {
    const { CheckoutRequestID, ResultCode, ResultDesc } = body.Body.stkCallback;

    const transaction = await this.prismaService.transaction.findUnique({
      where: { checkoutRequestId: CheckoutRequestID },
      include: { invoice: { include: { items: true } } },
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
    const paidAmount = transaction.amount;
    const newAmountPaid = invoice.amountPaid.plus(paidAmount);
    const diff = invoice.totalAmount.minus(newAmountPaid);
    const newBalanceDue = diff.isNegative() ? new Decimal(0) : diff;
    const newStatus = newBalanceDue.isZero()
      ? InvoiceStatus.PAID
      : InvoiceStatus.PARTIALLY_PAID;

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
    });

    this.logger.log(
      `Payment confirmed — txn ${transaction.transactionNumber}, receipt ${receiptNumber ?? 'N/A'}, invoice now ${newStatus}`,
    );
  }

  async findAll(
    query: QueryTransactionDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { transaction: ['list-any'] } },
    });
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
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { transaction: ['list-any'] } },
    });
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id, userId: isAdmin ? undefined : user.id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }
}
