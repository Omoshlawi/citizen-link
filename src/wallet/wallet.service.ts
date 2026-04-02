import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { isSuperUser, parseDate } from '../app.utils';
import { QueryWalletLedgerDto } from './wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly sortService: SortService,
  ) {}

  /**
   * Returns the wallet summary (balance, currency) for the requesting user.
   * Admins can pass userId to view any user's wallet.
   */
  async getWallet(user: UserSession['user'], userId?: string) {
    const targetUserId = isSuperUser(user) && userId ? userId : user.id;

    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId: targetUserId },
    });

    if (!wallet) {
      // Return a zero-balance wallet rather than 404 — user hasn't earned a reward yet
      return {
        id: null,
        userId: targetUserId,
        balance: 0,
        currency: 'KES',
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
    const isAdmin = isSuperUser(user);
    const targetUserId = isAdmin && query.userId ? query.userId : user.id;

    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId: targetUserId },
      select: { id: true },
    });

    if (!wallet) {
      return {
        results: [],
        ...this.paginationService.buildPaginationControls(0, originalUrl, query),
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
    const isAdmin = isSuperUser(user);

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
}
