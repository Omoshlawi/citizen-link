import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  ActiveStationMode,
  RequireActiveStation,
  RequireSystemPermission,
} from '../auth/auth.decorators';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';
import {
  CancelExchangeDto,
  CancelVerificationDto,
  ConfirmOutboundCodeDto,
  GetExchangeResponseDto,
  IssueVerificationResponseDto,
  QueryExchangeDto,
  QueryExchangeResponseDto,
  ScheduleInboundExchangeDto,
  ScheduleOutboundExchangeDto,
  VerifyExchangeCodeDto,
} from './document-exchange.dto';
import { DocumentExchangeInboundService } from './document-exchange.inbound.service';
import { DocumentExchangeOutboundService } from './document-exchange.outbound.service';

@Controller('exchange')
export class DocumentExchangeController {
  constructor(
    private readonly inbound: DocumentExchangeInboundService,
    private readonly outbound: DocumentExchangeOutboundService,
  ) {}

  // ─── Inbound — user (finder) routes ──────────────────────────────────────

  @Post('inbound/schedule')
  @ApiOperation({ summary: 'Schedule inbound exchange (finder/case owner)' })
  @ApiCreatedResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  scheduleInbound(
    @Body() dto: ScheduleInboundExchangeDto,
    @Session() userSession: UserSession,
  ) {
    return this.inbound.scheduleExchange(dto, userSession);
  }

  @Post('inbound/:foundCaseId/withdraw')
  @ApiOperation({
    summary:
      'Withdraw (cancel) a scheduled inbound exchange (finder/case owner)',
  })
  @ApiErrorsResponse({ badRequest: true })
  withdrawInbound(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: CancelExchangeDto,
    @Session() { user }: UserSession,
  ) {
    return this.inbound.cancelExchange(foundCaseId, dto, user, true);
  }

  // ─── Inbound — staff routes ───────────────────────────────────────────────

  @Post('inbound/:foundCaseId/issue-code')
  @ApiOperation({
    summary: 'Issue verification code for inbound exchange (staff only)',
  })
  @ApiCreatedResponse({ type: IssueVerificationResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  issueInboundCode(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Session() userSession: UserSession,
  ) {
    return this.inbound.issueVerification(foundCaseId, userSession);
  }

  @Post('inbound/:foundCaseId/verify')
  @ApiOperation({
    summary: 'Confirm verification code for inbound exchange (staff only)',
  })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  verifyInbound(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: VerifyExchangeCodeDto,
    @Session() userSession: UserSession,
  ) {
    return this.inbound.verifyCode(foundCaseId, dto, userSession);
  }

  @Post('inbound/:foundCaseId/cancel-code')
  @ApiOperation({
    summary:
      'Cancel active verification session, revert exchange to SCHEDULED (staff only)',
  })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  cancelInboundCode(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: CancelVerificationDto,
    @Session() { user }: UserSession,
  ) {
    return this.inbound.cancelVerification(foundCaseId, dto, user);
  }

  @Post('inbound/:foundCaseId/cancel')
  @ApiOperation({ summary: 'Cancel active inbound exchange (staff only)' })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  cancelInbound(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: CancelExchangeDto,
    @Session() { user }: UserSession,
  ) {
    return this.inbound.cancelExchange(foundCaseId, dto, user);
  }

  @Get('inbound/:foundCaseId/active')
  @ApiOperation({
    summary:
      'Get active inbound exchange state (code visible to document owner only)',
  })
  @ApiErrorsResponse()
  getActiveInbound(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Session() { user }: UserSession,
  ) {
    return this.inbound.getActiveExchangeState(foundCaseId, user);
  }

  // ─── Outbound — user (claimant) routes ───────────────────────────────────

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

  @Post('outbound/:id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled outbound exchange (claimant)' })
  @ApiOkResponse({ type: GetExchangeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  cancelOutbound(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.outbound.cancelOutbound(id, cancelDto, query, user);
  }

  // ─── Outbound — staff routes ──────────────────────────────────────────────

  @Post('outbound/:id/issue-code')
  @ApiOperation({
    summary: 'Issue verification code for outbound exchange (staff only)',
  })
  @ApiCreatedResponse({ type: IssueVerificationResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  issueOutboundCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() userSession: UserSession,
  ) {
    return this.outbound.issueVerification(id, userSession);
  }

  @Post('outbound/:id/cancel-code')
  @ApiOperation({
    summary:
      'Cancel active verification session, revert exchange to SCHEDULED (staff only)',
  })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  cancelOutboundCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelVerificationDto,
    @Session() { user }: UserSession,
  ) {
    return this.outbound.cancelVerification(id, dto, user);
  }

  @Post('outbound/:id/verify')
  @ApiOperation({
    summary: 'Confirm handover code for outbound exchange (staff only)',
  })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentCase: ['collect'] })
  @RequireActiveStation(ActiveStationMode.REQUIRED)
  confirmOutbound(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmOutboundCodeDto,
    @Session() userSession: UserSession,
  ) {
    return this.outbound.confirmVerification(id, dto, userSession);
  }

  // ─── Shared ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Query exchanges' })
  @ApiOkResponse({ type: QueryExchangeResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryExchangeDto,
    @OriginalUrl() originalUrl: string,
    @Session() { user }: UserSession,
  ) {
    return this.outbound.findAll(query, originalUrl, user);
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
    return this.outbound.findOne(id, query, user);
  }
}
