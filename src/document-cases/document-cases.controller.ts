import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { UserSession } from '../auth/auth.types';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../common/query-builder';
import {
  CaseTimelineResponseDto,
  CreateFoundDocumentCaseDto,
  GetDocumentCaseResponseDto,
  QueryDocumentCaseDto,
  QueryDocumentCaseResponseDto,
  CreateLostDocumentCaseDto,
  UpdateDocumentCaseDto,
} from './document-cases.dto';
import { DocumentCasesService } from './document-cases.service';
import { RequireSystemPermission } from '../auth/auth.decorators';
import { StatusTransitionReasonsDto } from '../status-transitions/status-transitions.dto';

@Controller('documents/cases')
export class DocumentCasesController {
  constructor(private readonly documentCasesService: DocumentCasesService) {}

  @Post('found')
  @ApiOperation({ summary: 'Report Found Document Case' })
  @ApiCreatedResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  reportFoundDocumentCase(
    @Body() createFoundDocumentCaseDto: CreateFoundDocumentCaseDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.reportFoundDocumentCase(
      createFoundDocumentCaseDto,
      query,
      user,
    );
  }

  @Post('lost')
  @ApiOperation({ summary: 'Report Lost Document Case (manual entry)' })
  @ApiCreatedResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  reportLostDocumentCase(
    @Body() createLostDocumentCaseDto: CreateLostDocumentCaseDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.reportLostDocumentCaseMannual(
      createLostDocumentCaseDto,
      query,
      user,
    );
  }

  @Post('lost/scan')
  @ApiOperation({
    summary: 'Report Lost Document Case via scan (async AI extraction)',
  })
  @ApiCreatedResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  reportLostDocumentCaseScanned(
    @Body() createFoundDocumentCaseDto: CreateFoundDocumentCaseDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.reportLostDocumentCaseScanned(
      createFoundDocumentCaseDto,
      query,
      user,
    );
  }

  @Post('lost/:id/submit')
  @ApiOperation({ summary: 'Submit Lost Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true, notFound: true })
  submitLostDocumentCase(
    @Param('id') id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.submitLostDocumentCase(id, query, user);
  }
  @Post('found/:id/submit')
  @ApiOperation({ summary: 'Submit Found Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true, notFound: true })
  submitFoundDocumentCase(
    @Param('id') id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.submitFoundDocumentCase(id, query, user);
  }

  @Get()
  @ApiOperation({ summary: 'Query Document Cases' })
  @ApiOkResponse({ type: QueryDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findAll(
    @Query() query: QueryDocumentCaseDto,
    @Session() { user }: UserSession,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.documentCasesService.findAll(query, user, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findOne(
    @Param('id') id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.findOne(id, query, user);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get Document Case Timeline' })
  @ApiOkResponse({ type: CaseTimelineResponseDto })
  @ApiErrorsResponse({ notFound: true })
  getCaseTimeline(
    @Param('id') id: string,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.getCaseTimeline(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  update(
    @Param('id') id: string,
    @Body() updateDocumentCaseDto: UpdateDocumentCaseDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.update(
      id,
      updateDocumentCaseDto,
      query,
      user,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  remove(
    @Param('id') id: string,
    @Query() query: DeleteQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.remove(id, query, user.id);
  }

  @Post('found/:id/verify')
  @RequireSystemPermission({ documentCase: ['verify'] })
  @ApiOperation({ summary: 'Verify Found Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  verifyFoundDocumentCase(
    @Param('id') id: string,
    @Body() verifyDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.verifyFoundDocumentCase(
      id,
      verifyDto,
      query,
      user,
    );
  }

  @Post('found/:id/reject')
  @RequireSystemPermission({ documentCase: ['reject'] })
  @ApiOperation({ summary: 'Reject Found Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  rejectFoundDocumentCase(
    @Param('id') id: string,
    @Body() rejectDto: StatusTransitionReasonsDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.rejectFoundDocumentCase(
      id,
      rejectDto,
      query,
      user,
    );
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  restore(
    @Param('id') id: string,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.restore(id, query, user.id);
  }
}
