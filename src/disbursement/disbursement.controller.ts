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
import { B2CCallbackBody } from '../payment/daraja.service';
import {
  GetDisbursementResponseDto,
  QueryDisbursementDto,
  QueryDisbursementResponseDto,
  WithdrawDisbursementDto,
} from './disbursement.dto';
import { DisbursementService } from './disbursement.service';

@Controller('disbursement')
export class DisbursementController {
  constructor(private readonly disbursementService: DisbursementService) {}

  @Get()
  @ApiOperation({ summary: 'Query disbursements' })
  @ApiOkResponse({ type: QueryDisbursementResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryDisbursementDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.disbursementService.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get disbursement by ID' })
  @ApiOkResponse({ type: GetDisbursementResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.disbursementService.findOne(id, query, user);
  }

  /**
   * Finder requests payout for a PENDING disbursement.
   * Triggers a Daraja B2C payment to the finder's M-Pesa account.
   */
  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Request payout for a pending disbursement' })
  @ApiOkResponse({ type: GetDisbursementResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawDisbursementDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.disbursementService.withdraw(id, dto, query, user);
  }

  /**
   * Daraja B2C result/timeout callback — no session auth (Daraja posts here directly).
   * Returns 200 regardless so Daraja does not retry.
   */
  @Post('callback/daraja-b2c')
  @ApiOperation({ summary: 'Daraja B2C result callback (internal)' })
  @AllowAnonymous()
  async darajaB2CCallback(@Body() body: B2CCallbackBody) {
    await this.disbursementService.handleB2CCallback(body);
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
