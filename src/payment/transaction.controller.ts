import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
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
