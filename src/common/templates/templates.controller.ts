import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Delete,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  GetTemplateResponseDto,
  QueryTemplateDto,
  QueryTemplateResponseDto,
  QueryTemplateVersionDto,
  QueryTemplateVersionResponseDto,
  TemplateVersionResponseDto,
  UpdateTemplateDto,
} from './templates.dto';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { RequireSystemPermission } from '../../auth/auth.decorators';
import { ApiErrorsResponse } from '../../app.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../query-builder';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import { UserSession } from '../../auth/auth.types';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Query Templates' })
  @ApiOkResponse({ type: QueryTemplateResponseDto })
  @ApiErrorsResponse()
  @AllowAnonymous()
  findAll(@Query() query: QueryTemplateDto, @OriginalUrl() url: string) {
    return this.templatesService.findAll(query, url);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get Template' })
  @ApiOkResponse({ type: GetTemplateResponseDto })
  @AllowAnonymous()
  findOne(@Param('key') key: string, @Query() query: QueryTemplateDto) {
    return this.templatesService.findOne(key, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create Template' })
  @ApiOkResponse({ type: GetTemplateResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ templates: ['create'] })
  create(
    @Body() createTemplateDto: CreateTemplateDto,
    @Query() query: QueryTemplateDto,
    @Session() { user }: UserSession,
  ) {
    return this.templatesService.create(createTemplateDto, user, query);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update Template' })
  @ApiOkResponse({ type: GetTemplateResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ templates: ['update'] })
  update(
    @Param('key') key: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
    @Query() query: QueryTemplateDto,
    @Session() { user }: UserSession,
  ) {
    return this.templatesService.update(key, updateTemplateDto, user, query);
  }

  @Get(':key/versions')
  @ApiOperation({ summary: 'Query Template Versions' })
  @ApiOkResponse({ type: QueryTemplateVersionResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @AllowAnonymous()
  findAllVersions(
    @Param('key') key: string,
    @Query() query: QueryTemplateVersionDto,
    @OriginalUrl() url: string,
  ) {
    return this.templatesService.findVersionHistory(key, query, url);
  }

  @Get(':key/versions/:version')
  @ApiOperation({ summary: 'Get Template Version' })
  @ApiOkResponse({ type: TemplateVersionResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @AllowAnonymous()
  findOneVersion(
    @Param('key') key: string,
    @Param('version', ParseIntPipe) version: number,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.templatesService.findVersion(key, version, query);
  }
  @Post(':key/rollback/:version')
  @ApiOperation({ summary: 'Rollback Template Version' })
  @ApiOkResponse({ type: GetTemplateResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ templates: ['update'] })
  rollbackVersion(
    @Param('key') key: string,
    @Param('version', ParseIntPipe) version: number,
    @Query() query: CustomRepresentationQueryDto,
    @Session() { user }: UserSession,
  ) {
    return this.templatesService.rollback(key, version, user, query);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete Template' })
  @ApiOkResponse({ type: GetTemplateResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ templates: ['delete'] })
  remove(@Param('key') key: string, @Query() query: DeleteQueryDto) {
    return this.templatesService.remove(key, query);
  }

  @Post(':key/restore')
  @ApiOperation({ summary: 'Restore Template' })
  @ApiOkResponse({ type: GetTemplateResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ templates: ['restore'] })
  restore(
    @Param('key') key: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.templatesService.restore(key, query);
  }
}
