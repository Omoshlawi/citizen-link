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
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import { OriginalUrl } from '../common/query-builder';
import {
  ConfirmTransferDto,
  CreateRequisitionDto,
  GetDocumentOperationResponseDto,
  InitiateTransferDto,
  QueryDocumentOperationsDto,
  RecordAuditDto,
  RecordConditionUpdateDto,
  RecordDisposalDto,
  RecordHandoverDto,
  RecordReceivedDto,
  RecordReturnDto,
} from './document-custody.dto';
import { DocumentCustodyOperationsService } from './document-custody-operations.service';
import { DocumentCustodyQueryService } from './document-custody-query.service';

@Controller('document-custody')
export class DocumentCustodyController {
  constructor(
    private readonly operationsService: DocumentCustodyOperationsService,
    private readonly queryService: DocumentCustodyQueryService,
  ) {}

  @Post(':foundCaseId/receive')
  @ApiOperation({ summary: 'Record document received at station' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  recordReceived(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: RecordReceivedDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.recordReceived(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/transfer')
  @ApiOperation({ summary: 'Initiate a document transfer to another station' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  initiateTransfer(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: InitiateTransferDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.initiateTransfer(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/transfer/confirm')
  @ApiOperation({ summary: 'Confirm receipt of a transferred document' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  confirmTransfer(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: ConfirmTransferDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.confirmTransfer(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/requisition')
  @ApiOperation({ summary: 'Create a requisition for a document' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  createRequisition(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: CreateRequisitionDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.createRequisition(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/handover')
  @ApiOperation({ summary: 'Record document handover to owner' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  recordHandover(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: RecordHandoverDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.recordHandover(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/dispose')
  @ApiOperation({ summary: 'Record document disposal' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  recordDisposal(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: RecordDisposalDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.recordDisposal(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/return')
  @ApiOperation({ summary: 'Record document return to station' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  recordReturn(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: RecordReturnDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.recordReturn(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/audit')
  @ApiOperation({ summary: 'Record a location audit for a document' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  recordAudit(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: RecordAuditDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.recordAudit(foundCaseId, dto, user);
  }

  @Post(':foundCaseId/condition')
  @ApiOperation({ summary: 'Record a condition update for a document' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  recordConditionUpdate(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Body() dto: RecordConditionUpdateDto,
    @Session() { user }: UserSession,
  ) {
    return this.operationsService.recordConditionUpdate(foundCaseId, dto, user);
  }

  @Get(':foundCaseId/history')
  @ApiOperation({ summary: 'Get operation history for a found document case' })
  @ApiErrorsResponse()
  getHistory(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Query() query: QueryDocumentOperationsDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.queryService.getHistory(foundCaseId, query, originalUrl);
  }
}
