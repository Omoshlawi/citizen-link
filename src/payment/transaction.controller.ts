import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  GetTransactionResponseDto,
  InitiatePaymentDto,
  QueryTransactionDto,
  QueryTransactionResponseDto,
} from './transaction.dto';
import { TransactionService } from './transaction.service';
import { StkCallbackBody } from './daraja.service';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Initiate an STK push payment.
   * - Agents (super users) can trigger for any invoice and set initiatedById.
   * - Clients can only trigger for their own invoice.
   */
  @Post('stk-push')
  @ApiOperation({ summary: 'Initiate STK push payment for an invoice' })
  @ApiOkResponse({ type: GetTransactionResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  initiatePayment(
    @Body() dto: InitiatePaymentDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.transactionService.initiatePayment(dto, query, user);
  }

  /**
   * Daraja STK push callback — no session auth (Daraja posts here directly).
   * Returns 200 immediately regardless of result so Daraja does not retry.
   */
  @Post('callback/daraja')
  @ApiOperation({ summary: 'Daraja STK push callback (internal)' })
  @AllowAnonymous()
  async darajaCallback(@Body() body: StkCallbackBody) {
    await this.transactionService.handleDarajaCallback(body);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  @Get()
  @ApiOperation({ summary: 'Query transactions' })
  @ApiOkResponse({ type: QueryTransactionResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryTransactionDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.transactionService.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiOkResponse({ type: GetTransactionResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.transactionService.findOne(id, query, user);
  }
}
