import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  WalletLedgerEntryDto,
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
}
