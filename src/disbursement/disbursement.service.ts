import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DisbursementStatus,
  Prisma,
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
import { PrismaService } from '../prisma/prisma.service';
import { isSuperUser, parseDate } from '../app.utils';
import { B2CCallbackBody, DarajaService } from '../payment/daraja.service';
import {
  QueryDisbursementDto,
  WithdrawDisbursementDto,
} from './disbursement.dto';
import { RegionService } from '../region/region.service';

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
    private readonly darajaService: DarajaService,
    private readonly regionService: RegionService,
  ) {}

  /**
   * Finder requests payout for a PENDING disbursement.
   * Decrements the wallet balance, initiates B2C, and advances status to INITIATED.
   */
  async withdraw(
    id: string,
    dto: WithdrawDisbursementDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);

    const disbursement = await this.prismaService.disbursement.findUnique({
      where: { id },
      include: {
        recipient: { select: { id: true, phoneNumber: true } },
      },
    });

    if (!disbursement || (!isAdmin && disbursement.recipientId !== user.id)) {
      throw new NotFoundException('Disbursement not found');
    }

    if (disbursement.status !== DisbursementStatus.PENDING) {
      throw new BadRequestException(
        `Disbursement is already ${disbursement.status.toLowerCase()} — only PENDING disbursements can be withdrawn`,
      );
    }

    // Resolve phone: DTO override → recipient's on-file number
    const rawPhone =
      dto.phoneNumber ?? disbursement.recipient.phoneNumber ?? undefined;
    if (!rawPhone) {
      throw new BadRequestException(
        'No phone number available for payout. Please provide phoneNumber in the request.',
      );
    }
    const phone = this.regionService.toDarajaPhone(rawPhone);

    const amount = disbursement.amount.toNumber();

    // Atomically advance status + debit wallet before calling Daraja
    await this.prismaService.$transaction(async (tx) => {
      await tx.disbursement.update({
        where: { id },
        data: { status: DisbursementStatus.INITIATED, initiatedAt: new Date() },
      });

      const wallet = await tx.wallet.findUnique({
        where: { userId: disbursement.recipientId },
      });
      if (!wallet) {
        throw new BadRequestException('Wallet not found for this user');
      }

      const balanceBefore = wallet.balance.toNumber();
      const balanceAfter = Math.max(0, balanceBefore - amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amount } },
      });

      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: WalletEntryType.DEBIT,
          reason: WalletEntryReason.WITHDRAWAL,
          amount,
          balanceBefore,
          balanceAfter,
          referenceType: 'Disbursement',
          referenceId: id,
          description: `Withdrawal for disbursement ${disbursement.disbursementNumber}`,
        },
      });
    });

    // Call Daraja B2C — if it fails, roll back status to PENDING and restore wallet
    try {
      const b2cResponse = await this.darajaService.initiateB2CPayout({
        phoneNumber: phone,
        amount,
        reference: disbursement.disbursementNumber,
        remarks: `Finder reward disbursement ${disbursement.disbursementNumber}`,
      });

      return await this.prismaService.disbursement.update({
        where: { id },
        data: {
          metadata: {
            conversationId: b2cResponse.ConversationID,
            originatorConversationId: b2cResponse.OriginatorConversationID,
          },
        },
        ...this.representationService.buildCustomRepresentationQuery(query?.v),
      });
    } catch (err) {
      // Revert to PENDING and restore wallet balance on Daraja failure
      await this.prismaService.$transaction(async (tx) => {
        await tx.disbursement.update({
          where: { id },
          data: {
            status: DisbursementStatus.PENDING,
            initiatedAt: null,
          },
        });

        const wallet = await tx.wallet.findUnique({
          where: { userId: disbursement.recipientId },
        });
        if (wallet) {
          const balanceBefore = wallet.balance.toNumber();
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: amount } },
          });
          await tx.walletLedger.create({
            data: {
              walletId: wallet.id,
              type: WalletEntryType.CREDIT,
              reason: WalletEntryReason.WITHDRAWAL_REVERSAL,
              amount,
              balanceBefore,
              balanceAfter: balanceBefore + amount,
              referenceType: 'Disbursement',
              referenceId: id,
              description: `Withdrawal reversal (Daraja initiation failed) for disbursement ${disbursement.disbursementNumber}`,
            },
          });
        }
      });

      throw err;
    }
  }

  /**
   * Daraja B2C result callback — no session auth, Daraja posts directly.
   * Matches by ConversationID stored in disbursement metadata.
   */
  async handleB2CCallback(body: B2CCallbackBody) {
    const { ConversationID, ResultCode, ResultDesc, TransactionID } =
      body.Result;

    // Find disbursement by ConversationID stored in JSON metadata
    const disbursement = await this.prismaService.disbursement.findFirst({
      where: {
        metadata: { path: ['conversationId'], equals: ConversationID },
      },
    });

    if (!disbursement) {
      this.logger.warn(
        `B2C callback for unknown ConversationID: ${ConversationID}`,
      );
      return;
    }

    if (disbursement.status === DisbursementStatus.COMPLETED) {
      this.logger.warn(
        `Duplicate B2C callback for already-completed disbursement ${disbursement.id}`,
      );
      return;
    }

    const success = ResultCode === 0;

    if (success) {
      await this.prismaService.disbursement.update({
        where: { id: disbursement.id },
        data: {
          status: DisbursementStatus.COMPLETED,
          completedAt: new Date(),
          providerTransactionId: TransactionID,
          metadata: {
            ...(disbursement.metadata as object),
            resultCode: ResultCode,
            resultDesc: ResultDesc,
          },
        },
      });
      this.logger.log(
        `B2C payout completed — disbursement ${disbursement.disbursementNumber}, receipt ${TransactionID}`,
      );
    } else {
      this.logger.warn(
        `B2C payout failed — ${ResultDesc} (disbursement ${disbursement.id})`,
      );

      const amount = disbursement.amount.toNumber();

      await this.prismaService.$transaction(async (tx) => {
        await tx.disbursement.update({
          where: { id: disbursement.id },
          data: {
            status: DisbursementStatus.FAILED,
            metadata: {
              ...(disbursement.metadata as object),
              resultCode: ResultCode,
              resultDesc: ResultDesc,
            },
          },
        });

        // Restore wallet balance on failure
        const wallet = await tx.wallet.findUnique({
          where: { userId: disbursement.recipientId },
        });
        if (wallet) {
          const balanceBefore = wallet.balance.toNumber();
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: amount } },
          });
          await tx.walletLedger.create({
            data: {
              walletId: wallet.id,
              type: WalletEntryType.CREDIT,
              reason: WalletEntryReason.WITHDRAWAL_REVERSAL,
              amount,
              balanceBefore,
              balanceAfter: balanceBefore + amount,
              referenceType: 'Disbursement',
              referenceId: disbursement.id,
              description: `Withdrawal reversal (B2C failed: ${ResultDesc}) for disbursement ${disbursement.disbursementNumber}`,
            },
          });
        }
      });
    }
  }

  async findAll(
    query: QueryDisbursementDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    const isAdmin = isSuperUser(user);
    const dbQuery: Prisma.DisbursementWhereInput = {
      AND: [
        {
          status: query.status,
          recipientId: isAdmin ? query.recipientId : user.id,
          createdAt: {
            gte: parseDate(query.createdAtFrom),
            lte: parseDate(query.createdAtTo),
          },
        },
      ],
    };

    const totalCount = await this.prismaService.disbursement.count({
      where: dbQuery,
    });

    const data = await this.prismaService.disbursement.findMany({
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
    const disbursement = await this.prismaService.disbursement.findUnique({
      where: { id, recipientId: isAdmin ? undefined : user.id },
      ...this.representationService.buildCustomRepresentationQuery(query?.v),
    });
    if (!disbursement) throw new NotFoundException('Disbursement not found');
    return disbursement;
  }
}
