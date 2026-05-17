import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  GetWalletResponseDto,
  QueryWalletLedgerDto,
  QueryWalletLedgerResponseDto,
  QueryWalletWithdrawalDto,
  QueryWalletWithdrawalResponseDto,
  WalletLedgerEntryDto,
  WalletWithdrawalDto,
  WithdrawFromWalletDto,
} from './wallet.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Returns the authenticated user's wallet balance and currency.
   * Admins can pass ?userId= to view any user's wallet.
   */
  @Get()
  @ApiOperation({ summary: "Get the authenticated user's wallet" })
  @ApiOkResponse({ type: GetWalletResponseDto })
  @ApiQuery({ name: 'userId', required: false, description: 'Admin only' })
  @ApiErrorsResponse({ notFound: false })
  getWallet(
    @Query('userId') userId: string | undefined,
    @Session() { user }: UserSession,
  ) {
    return this.walletService.getWallet(user, userId);
  }

  /**
   * Returns the authenticated user's paginated wallet ledger.
   * Filterable by type, reason, and date range.
   * Admins can pass query.userId to view any user's ledger.
   */
  @Get('ledger')
  @ApiOperation({ summary: "Get the authenticated user's wallet ledger" })
  @ApiOkResponse({ type: QueryWalletLedgerResponseDto })
  @ApiErrorsResponse()
  getLedger(
    @Query() query: QueryWalletLedgerDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.walletService.getLedger(query, originalUrl, user);
  }

  /**
   * Returns a single wallet ledger entry by ID.
   * Users can only access entries from their own wallet.
   */
  @Get('ledger/:id')
  @ApiOperation({ summary: 'Get a wallet ledger entry by ID' })
  @ApiOkResponse({ type: WalletLedgerEntryDto })
  @ApiErrorsResponse()
  getLedgerEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.walletService.getLedgerEntry(id, query, user);
  }

  /**
   * Returns paginated withdrawal history for the authenticated user.
   * Admins can pass ?userId= to view any user's withdrawals.
   */
  @Get('withdrawals')
  @ApiOperation({ summary: "Get the authenticated user's withdrawal history" })
  @ApiOkResponse({ type: QueryWalletWithdrawalResponseDto })
  @ApiErrorsResponse()
  getWithdrawals(
    @Query() query: QueryWalletWithdrawalDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.walletService.getWithdrawals(query, originalUrl, user);
  }

  /**
   * User requests a payout to their M-Pesa account.
   * Atomically debits the wallet and initiates a Daraja B2C payment.
   */
  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw funds from wallet to M-Pesa' })
  @ApiOkResponse({ type: WalletWithdrawalDto })
  @ApiErrorsResponse({ badRequest: true })
  withdraw(
    @Body() dto: WithdrawFromWalletDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.walletService.withdraw(dto, query, user);
  }
}
