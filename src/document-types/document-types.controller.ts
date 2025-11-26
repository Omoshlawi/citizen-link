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
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../query-builder';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CreateDocumentTypeDto,
  GetDocumentTypeResponseDto,
  QueryDocumentTypeDto,
  UpdateDocumentTypeDto,
  QueryDocumentTypeResponseDto,
} from './document-type.dto';
import { DocumentTypesService } from './document-types.service';
import { RequireSystemPermission } from '../auth/auth.decorators';

@Controller('documents/types')
export class DocumentTypesController {
  constructor(private readonly documentTypesService: DocumentTypesService) {}

  @Post()
  @RequireSystemPermission({ documentType: ['create'] })
  @ApiOperation({ summary: 'Create Document Type' })
  @ApiOkResponse({ type: GetDocumentTypeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  create(
    @Body() createDocumentTypeDto: CreateDocumentTypeDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.documentTypesService.create(createDocumentTypeDto, query);
  }
  @Get()
  @ApiOperation({ summary: 'Query Document Type' })
  @ApiOkResponse({ type: QueryDocumentTypeResponseDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryDocumentTypeDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.documentTypesService.findAll(query, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Document Type' })
  @ApiOkResponse({ type: GetDocumentTypeResponseDto })
  @ApiErrorsResponse()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.documentTypesService.findOne(id, query);
  }

  @Patch(':id')
  @RequireSystemPermission({ documentType: ['update'] })
  @ApiOperation({ summary: 'Update Document Type' })
  @ApiOkResponse({ type: GetDocumentTypeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDocumentTypeDto: UpdateDocumentTypeDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.documentTypesService.update(id, updateDocumentTypeDto, query);
  }

  @Delete(':id')
  @RequireSystemPermission({ documentType: ['delete'] })
  @ApiOperation({ summary: 'Delete Document Type' })
  @ApiOkResponse({ type: GetDocumentTypeResponseDto })
  @ApiErrorsResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ) {
    return this.documentTypesService.remove(id, query);
  }

  @Post(':id/restore')
  @RequireSystemPermission({ documentType: ['restore'] })
  @ApiOperation({ summary: 'Restore Document Type' })
  @ApiOkResponse({ type: GetDocumentTypeResponseDto })
  @ApiErrorsResponse()
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.documentTypesService.restore(id, query);
  }
}
