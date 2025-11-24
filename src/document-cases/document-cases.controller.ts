/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DocumentCasesService } from './document-cases.service';
import {
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../query-builder';
import { Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../auth/auth.types';
import {
  CreateDocumentCaseDto,
  QueryDocumentCaseDto,
  QueryDocumentCaseResponseDto,
  UpdateDocumentCaseDto,
} from './document-cases.dto';
import { GetDocumentCaseResponseDto } from './document-cases.dto';

@Controller('documents/cases')
export class DocumentCasesController {
  constructor(private readonly documentCasesService: DocumentCasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create Document Case' })
  @ApiCreatedResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  create(
    @Body() createDocumentCaseDto: CreateDocumentCaseDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.create(
      createDocumentCaseDto,
      query,
      user.id,
    );
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
    return this.documentCasesService.findAll(query, user.id, originalUrl);
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
    return this.documentCasesService.findOne(id, query, user.id);
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
      user.id,
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
