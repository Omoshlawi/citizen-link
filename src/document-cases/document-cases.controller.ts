/* eslint-disable @typescript-eslint/no-unsafe-return */
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
} from '../query-builder';
import {
  CreateFoundDocumentCaseDto,
  GetDocumentCaseResponseDto,
  QueryDocumentCaseDto,
  QueryDocumentCaseResponseDto,
  CreateLostDocumentCaseDto,
} from './document-cases.dto';
import { DocumentCasesService } from './document-cases.service';

@Controller('documents/cases')
export class DocumentCasesController {
  constructor(private readonly documentCasesService: DocumentCasesService) {}

  @Post()
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
  @ApiOperation({ summary: 'Report Lost Document Case' })
  @ApiOkResponse({ type: GetDocumentCaseResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  reportLostDocumentCase(
    @Param('id') id: string,
    @Body() createLostDocumentCaseDto: CreateLostDocumentCaseDto,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.documentCasesService.reportLostDocumentCase(
      id,
      createLostDocumentCaseDto,
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
