import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WalletEntryReason,
  WalletEntryType,
  WalletWithdrawalStatus,
} from '../../generated/prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { parseDate } from '../app.utils';
import { BetterAuthWithPlugins } from '../auth/auth.types';
import { AuthService } from '@thallesp/nestjs-better-auth';
import {
  QueryWalletLedgerDto,
  QueryWalletWithdrawalDto,
  WithdrawFromWalletDto,
} from './wallet.dto';
import { RegionService } from '../region/region.service';
import { DarajaService } from '../daraja/daraja.service';
import { HumanIdService } from '../human-id/human-id.service';
import { EntityPrefix } from '../human-id/human-id.constants';
import { B2CCallbackBodyDto } from '../daraja/daraja.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly sortService: SortService,
    private readonly representationService: CustomRepresentationService,
    private readonly regionService: RegionService,
    private readonly authService: AuthService<BetterAuthWithPlugins>,
    private readonly darajaService: DarajaService,
    private readonly humanId: HumanIdService,
  ) {}

  /**
   * Returns the wallet summary (balance, currency) for the requesting user.
   * Admins can pass userId to view any user's wallet.
   */
  async getWallet(user: UserSession['user'], userId?: string) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { wallet: ['view-any'] } },
    });
    const targetUserId = isAdmin && userId ? userId : user.id;

    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId: targetUserId },
    });

    if (!wallet) {
      // Return a zero-balance wallet rather than 404 — user hasn't earned a reward yet
      return {
        id: null,
        userId: targetUserId,
        balance: 0,
        currency: this.regionService.getCurrency(),
        updatedAt: null,
      };
    }

    return wallet;
  }

  /**
   * Returns the paginated ledger for the requesting user's wallet.
   * Admins can pass query.userId to view any user's ledger.
   */
  async getLedger(
    query: QueryWalletLedgerDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { wallet: ['view-any'] } },
    });
    const targetUserId = isAdmin && query.userId ? query.userId : user.id;

    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId: targetUserId },
      select: { id: true },
    });

    if (!wallet) {
      return {
        results: [],
        ...this.paginationService.buildPaginationControls(
          0,
          originalUrl,
          query,
        ),
      };
    }

    const where: Prisma.WalletLedgerWhereInput = {
      walletId: wallet.id,
      type: query.type,
      reason: query.reason,
      createdAt: {
        gte: parseDate(query.createdAtFrom),
        lte: parseDate(query.createdAtTo),
      },
    };

    const totalCount = await this.prismaService.walletLedger.count({ where });

    const data = await this.prismaService.walletLedger.findMany({
      where,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
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

  /**
   * Returns a single ledger entry. Users can only access entries from their own wallet;
   * admins can access any entry.
   */
  async getLedgerEntry(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { wallet: ['view-any'] } },
    });

    const entry = await this.prismaService.walletLedger.findUnique({
      where: { id },
      include: { wallet: { select: { userId: true } } },
    });

    if (!entry || (!isAdmin && entry.wallet.userId !== user.id)) {
      throw new NotFoundException('Ledger entry not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wallet: _wallet, ...result } = entry;
    return result;
  }

  /**
   * Returns paginated withdrawal history for the requesting user.
   */
  async getWithdrawals(
    query: QueryWalletWithdrawalDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const { success: isAdmin } = await this.authService.api.userHasPermission({
      body: { userId: user.id, permission: { wallet: ['view-any'] } },
    });
    const targetUserId = isAdmin && query.userId ? query.userId : user.id;

    const where: Prisma.WalletWithdrawalWhereInput = {
      userId: targetUserId,
      status: query.status,
      createdAt: {
        gte: parseDate(query.createdAtFrom),
        lte: parseDate(query.createdAtTo),
      },
    };

    const totalCount = await this.prismaService.walletWithdrawal.count({
      where,
    });
    const data = await this.prismaService.walletWithdrawal.findMany({
      where,
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.sortService.buildSortQuery(query?.orderBy ?? '-createdAt'),
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

  /**
   * User requests a payout of a specified amount to their M-Pesa account.
   * Atomically debits the wallet, creates a WalletWithdrawal record, and
   * initiates a Daraja B2C payment. On Daraja failure, the debit is reversed.
   */
  async withdraw(
    dto: WithdrawFromWalletDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId: user.id },
    });

    if (!wallet) {
      throw new BadRequestException(
        'No wallet found. Earn a finder reward first.',
      );
    }

    const requestedAmount = new Decimal(dto.amount);
    if (requestedAmount.greaterThan(wallet.balance)) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${wallet.balance.toFixed(2)} ${wallet.currency}.`,
      );
    }

    const rawPhone = dto.phoneNumber ?? user.phoneNumber ?? undefined;
    if (!rawPhone) {
      throw new BadRequestException(
        'No phone number on file. Please provide phoneNumber in the request.',
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

    const withdrawalNumber = await this.humanId.generate({
      prefix: EntityPrefix.WITHDRAWAL,
    });

    let withdrawal: { id: string; withdrawalNumber: string };
    await this.prismaService.$transaction(async (tx) => {
      withdrawal = await tx.walletWithdrawal.create({
        data: {
          withdrawalNumber,
          walletId: wallet.id,
          userId: user.id,
          amount: requestedAmount,
          currency: this.regionService.getCurrency(),
          phoneNumber: phone,
          status: WalletWithdrawalStatus.INITIATED,
        },
        select: { id: true, withdrawalNumber: true },
      });

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore.minus(requestedAmount).isNegative()
        ? new Decimal(0)
        : balanceBefore.minus(requestedAmount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: requestedAmount } },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: WalletEntryType.DEBIT,
          reason: WalletEntryReason.WITHDRAWAL,
          amount: requestedAmount,
          currency: this.regionService.getCurrency(),
          balanceBefore,
          balanceAfter,
          referenceType: 'WalletWithdrawal',
          referenceId: withdrawal.id,
          description: `Withdrawal ${withdrawal.withdrawalNumber}`,
        },
      });
    });

    // Call Daraja B2C — if it fails, roll back
    try {
      const b2cResponse = await this.darajaService.initiateB2CPayout({
        phoneNumber: phone,
        amount: requestedAmount.toNumber(),
        reference: withdrawal!.withdrawalNumber,
        remarks: `Wallet withdrawal ${withdrawal!.withdrawalNumber}`,
      });

      return await this.prismaService.walletWithdrawal.update({
        where: { id: withdrawal!.id },
        data: {
          metadata: {
            conversationId: b2cResponse.ConversationID,
            originatorConversationId: b2cResponse.OriginatorConversationID,
          },
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } catch (err) {
      await this.prismaService.$transaction(async (tx) => {
        await tx.walletWithdrawal.update({
          where: { id: withdrawal!.id },
          data: { status: WalletWithdrawalStatus.FAILED, failedAt: new Date() },
        });

        const walletNow = await tx.wallet.findUnique({
          where: { id: wallet.id },
        });
        if (walletNow) {
          const balanceBefore = walletNow.balance;
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: requestedAmount } },
          });
          await tx.walletLedger.create({
            data: {
              walletId: wallet.id,
              type: WalletEntryType.CREDIT,
              reason: WalletEntryReason.WITHDRAWAL_REVERSAL,
              amount: requestedAmount,
              currency: this.regionService.getCurrency(),
              balanceBefore,
              balanceAfter: balanceBefore.plus(requestedAmount),
              referenceType: 'WalletWithdrawal',
              referenceId: withdrawal!.id,
              description: `Withdrawal reversal (Daraja initiation failed) for ${withdrawal!.withdrawalNumber}`,
            },
          });
        }
      });
      throw err;
    }
  }

  /**
   * Handles a Daraja B2C callback for a WalletWithdrawal.
   * Returns true if the callback was handled, false if no matching withdrawal was found.
   */
  async handleWithdrawalCallback(body: B2CCallbackBodyDto): Promise<boolean> {
    const { ConversationID, ResultCode, ResultDesc, TransactionID } =
      body.Result;

    const withdrawal = await this.prismaService.walletWithdrawal.findFirst({
      where: {
        metadata: { path: ['conversationId'], equals: ConversationID },
      },
    });

    if (!withdrawal) return false;

    if (withdrawal.status === WalletWithdrawalStatus.COMPLETED) {
      this.logger.warn(
        `Duplicate B2C callback for already-completed withdrawal ${withdrawal.id}`,
      );
      return true;
    }

    const success = ResultCode === 0;

    if (success) {
      await this.prismaService.walletWithdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WalletWithdrawalStatus.COMPLETED,
          completedAt: new Date(),
          providerTransactionId: TransactionID,
          metadata: {
            ...(withdrawal.metadata as object),
            resultCode: ResultCode,
            resultDesc: ResultDesc,
          },
        },
      });
      this.logger.log(
        `B2C payout completed — withdrawal ${withdrawal.withdrawalNumber}, receipt ${TransactionID}`,
      );
    } else {
      this.logger.warn(
        `B2C payout failed — ${ResultDesc} (withdrawal ${withdrawal.withdrawalNumber})`,
      );

      await this.prismaService.$transaction(async (tx) => {
        await tx.walletWithdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: WalletWithdrawalStatus.FAILED,
            failedAt: new Date(),
            metadata: {
              ...(withdrawal.metadata as object),
              resultCode: ResultCode,
              resultDesc: ResultDesc,
            },
          },
        });

        const wallet = await tx.wallet.findUnique({
          where: { id: withdrawal.walletId },
        });
        if (wallet) {
          const balanceBefore = wallet.balance;
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: withdrawal.amount } },
          });
          await tx.walletLedger.create({
            data: {
              walletId: wallet.id,
              type: WalletEntryType.CREDIT,
              reason: WalletEntryReason.WITHDRAWAL_REVERSAL,
              amount: withdrawal.amount,
              currency: this.regionService.getCurrency(),
              balanceBefore,
              balanceAfter: balanceBefore.plus(withdrawal.amount),
              referenceType: 'WalletWithdrawal',
              referenceId: withdrawal.id,
              description: `Withdrawal reversal (B2C failed: ${ResultDesc}) for ${withdrawal.withdrawalNumber}`,
            },
          });
        }
      });
    }

    return true;
  }
}
