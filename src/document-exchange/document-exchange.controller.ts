import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import {
  ActiveStationMode,
  RequireActiveStation,
  RequireSystemPermission,
} from '../auth/auth.decorators';
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import { DocumentExchangeBidirectionService } from './document-exchange.bidirection.service';
import { DocumentExchangeDeliveryService } from './document-exchange.delivery.service';
import { DocumentExchangeLabelService } from './document-exchange.label.service';
import { DocumentExchangePolicyService } from './document-exchange.policy.service';
import {
  CancelCodeQueryDto,
  CancelExchangeDto,
  CancelVerificationDto,
  ConfirmDeliveryQueryDto,
  FailDeliveryDto,
  FailDeliveryQueryDto,
  GetExchangeResponseDto,
  IssueCodeQueryDto,
  QueryExchangeDto,
  QueryExchangeResponseDto,
  ScheduleInboundExchangeDto,
  ScheduleOutboundExchangeDto,
  UpdateOutboundExchangeDto,
  VerifyCodeQueryDto,
  VerifyExchangeCodeDto,
  WithdrawScheduleQueryDto,
} from './document-exchange.dto';
import { DocumentExchangeInboundService } from './document-exchange.inbound.service';
import { DocumentExchangeOutboundService } from './document-exchange.outbound.service';

@Controller('exchange')
export class DocumentExchangeController {
  constructor(
    private readonly inbound: DocumentExchangeInboundService,
    private readonly outbound: DocumentExchangeOutboundService,
    private readonly biderection: DocumentExchangeBidirectionService,
    private readonly delivery: DocumentExchangeDeliveryService,
    private readonly label: DocumentExchangeLabelService,
    private readonly policyService: DocumentExchangePolicyService,
  ) {}

  @Post('inbound')
  @ApiOperation({ summary: 'Schedule inbound exchange (finder/case owner)' })
  @ApiCreatedResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  scheduleInbound(
    @Body() dto: ScheduleInboundExchangeDto,
    @Session() userSession: UserSession,
  ) {
    return this.inbound.scheduleExchange(dto, userSession);
  }

  @Post('outbound')
  @ApiOperation({
    summary: 'Schedule outbound exchange after claim is verified (claimant)',
  })
  @ApiCreatedResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  scheduleOutbound(
    @Body() dto: ScheduleOutboundExchangeDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.outbound.scheduleExchange(dto, query, user);
  }

  @Patch('outbound')
  @ApiOperation({
    summary:
      'Update the active SCHEDULED outbound exchange for a claim (claimant)',
  })
  @ApiOkResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  updateOutbound(
    @Body() dto: UpdateOutboundExchangeDto,
    @Session() { user }: UserSession,
  ) {
    return this.outbound.updateExchange(dto, user);
  }

  @Post('withdraw')
  @ApiOperation({
    summary: 'Withdraw/cancel a scheduled exchange (end user)',
  })
  @ApiCreatedResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  withdraw(
    @Query() query: WithdrawScheduleQueryDto,
    @Body() dto: CancelExchangeDto,
    @Session() { user }: UserSession,
  ) {
    return this.biderection.withDraw(query, dto, user);
  }

  @Post('issue-code')
  @ApiOperation({
    summary: 'Issue verification code for exchange (staff only)',
  })
  @ApiCreatedResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  issueCode(
    @Query() query: IssueCodeQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.biderection.issueCode(query, user);
  }

  @Post('verify-code')
  @ApiOperation({
    summary: 'Verify exchange',
  })
  @ApiCreatedResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  verifyInbound(
    @Query() query: VerifyCodeQueryDto,
    @Body() dto: VerifyExchangeCodeDto,
    @Session() userSession: UserSession,
  ) {
    return this.biderection.verifyCode(query, dto, userSession);
  }

  @Post('cancel-code')
  @ApiOperation({
    summary:
      'Cancel active verification session, revert exchange to SCHEDULED (staff only)',
  })
  @ApiErrorsResponse({ badRequest: true })
  @ApiCreatedResponse({ type: GetExchangeResponseDto })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  cancelInboundCode(
    @Query() query: CancelCodeQueryDto,
    @Body() dto: CancelVerificationDto,
    @Session() { user }: UserSession,
  ) {
    return this.biderection.cancelCode(query, dto, user);
  }
  @Post('confirm-delivery')
  @ApiOperation({
    summary: 'Owner confirms document receipt using code from package label',
  })
  @ApiCreatedResponse()
  @ApiErrorsResponse({ badRequest: true })
  confirmDelivery(
    @Query() query: ConfirmDeliveryQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.delivery.confirmDelivery(query.code, user);
  }

  @Post('fail-delivery')
  @ApiOperation({ summary: 'Staff marks courier delivery as failed' })
  @ApiCreatedResponse()
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  failDelivery(
    @Query() query: FailDeliveryQueryDto,
    @Body() dto: FailDeliveryDto,
    @Session() { user }: UserSession,
  ) {
    return this.delivery.failDelivery(query.exchangeNumber, dto.reason, user);
  }

  @Get('delivery-label/:exchangeNumber')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Get printable delivery label HTML (staff only)' })
  @ApiOkResponse({ description: 'Printable HTML label' })
  @ApiErrorsResponse()
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  getDeliveryLabel(
    @Param('exchangeNumber') exchangeNumber: string,
    @Session() _: UserSession,
  ) {
    return this.label.getLabel(exchangeNumber);
  }

  @Get('delivery-policy')
  @ApiOperation({ summary: 'Get courier delivery policy and zone fees' })
  @ApiOkResponse()
  getDeliveryPolicy() {
    return this.policyService.getPolicy();
  }

  @Get()
  @ApiOperation({ summary: 'Query exchanges' })
  @ApiOkResponse({ type: QueryExchangeResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryExchangeDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.biderection.findAll(query, originalUrl, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exchange by ID' })
  @ApiOkResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.biderection.findOne(id, query, user);
  }
}
