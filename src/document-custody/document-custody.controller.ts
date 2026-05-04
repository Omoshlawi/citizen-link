import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  AddOperationItemDto,
  CancelOperationDto,
  CreateDocumentOperationDto,
  GetAllowedOperationsDto,
  GetAllowedOperationsResponseDto,
  GetDocumentOperationResponseDto,
  GetDocumentOperationsListDto,
  QueryDocumentOperationsListDto,
  RejectOperationDto,
  SkipOperationItemDto,
  UpdateDocumentOperationDto,
} from './document-custody.dto';
import { DocumentCustodyService } from './document-custody.service';
import { RequireSystemPermission } from 'src/auth/auth.decorators';

@Controller('document-custody')
export class DocumentCustodyController {
  constructor(private readonly custodyService: DocumentCustodyService) {}

  //  Operation CRUD

  @Get('operations')
  @ApiOperation({ summary: 'List document custody operations' })
  @ApiOkResponse({ type: GetDocumentOperationsListDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ documentOperation: ['manage'] })
  listOperations(
    @Query() query: QueryDocumentOperationsListDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.custodyService.findMany(query, originalUrl);
  }

  @Get('allowed-operations')
  @ApiOperation({
    summary:
      'Get allowed operations for the current user or specified user at a specific station',
  })
  @ApiOkResponse({ type: GetAllowedOperationsResponseDto })
  @ApiErrorsResponse()
  getAllowedOperations(
    @Query() dto: GetAllowedOperationsDto,
    @Session() { user }: UserSession,
  ) {
    return this.custodyService.getAllowedOperations(dto, user);
  }

  @Post('operations')
  @ApiOperation({ summary: 'Create a new DRAFT custody operation' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  createOperation(
    @Body() dto: CreateDocumentOperationDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.create(dto, user, query);
  }

  @Get('operations/:id')
  @ApiOperation({ summary: 'Get a custody operation by ID' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ documentOperation: ['manage'] })
  getOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.findOne(id, query);
  }

  @Patch('operations/:id')
  @ApiOperation({ summary: 'Edit a DRAFT custody operation' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  updateOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentOperationDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.update(id, dto, user, query);
  }

  //  Item Management

  @Post('operations/:id/items')
  @ApiOperation({ summary: 'Add a found document to a DRAFT operation' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOperationItemDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.addItem(id, dto, user, query);
  }

  @Delete('operations/:id/items/:itemId')
  @ApiOperation({ summary: 'Remove a document from a DRAFT operation' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.removeItem(id, itemId, user, query);
  }

  @Post('operations/:id/items/:itemId/skip')
  @ApiOperation({ summary: 'Skip a PENDING item (exclude it from execution)' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  skipItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SkipOperationItemDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.skipItem(id, itemId, dto, user, query);
  }

  //  Lifecycle Transitions

  @Post('operations/:id/submit')
  @ApiOperation({ summary: 'Submit operation for supervisor approval' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  submitOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.submit(id, user, query);
  }

  @Post('operations/:id/approve')
  @ApiOperation({ summary: 'Approve a submitted operation' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['approve'] })
  approveOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.approve(id, user, query);
  }

  @Post('operations/:id/reject')
  @ApiOperation({ summary: 'Reject a submitted operation (returns to DRAFT)' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['reject'] })
  rejectOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOperationDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.reject(id, dto, user, query);
  }

  @Post('operations/:id/execute')
  @ApiOperation({ summary: 'Execute operation — applies custody transitions' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  executeOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.execute(id, user, query);
  }

  @Post('operations/:id/cancel')
  @ApiOperation({ summary: 'Cancel an operation' })
  @ApiOkResponse({ type: GetDocumentOperationResponseDto })
  @ApiErrorsResponse({ badRequest: true, forbidden: true })
  @RequireSystemPermission({ documentOperation: ['manage'] })
  cancelOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOperationDto,
    @Session() { user }: UserSession,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.custodyService.cancel(id, dto, user, query);
  }

  //  Per-case history (used by CustodyDetailPage)

  @Get(':foundCaseId/history')
  @ApiOperation({ summary: 'Get operation history for a found document case' })
  @ApiOkResponse({ type: GetDocumentOperationsListDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ documentOperation: ['manage'] })
  getHistory(
    @Param('foundCaseId', ParseUUIDPipe) foundCaseId: string,
    @Query() query: QueryDocumentOperationsListDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.custodyService.getHistory(foundCaseId, query, originalUrl);
  }
}
