import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../../app.decorators';
import { RequireSystemPermission } from '../../auth/auth.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
  OriginalUrl,
} from '../../common/query-builder';
import {
  CreateDocumentOperationTypeDto,
  GetDocumentOperationTypeResponseDto,
  GetDocumentOperationTypesListDto,
  QueryDocumentOperationTypesDto,
  UpdateDocumentOperationTypeDto,
} from './document-operation-type.dto';
import { DocumentOperationTypeService } from './document-operation-type.service';

@Controller('document-operation-types')
export class DocumentOperationTypeController {
  constructor(private readonly service: DocumentOperationTypeService) {}

  @Get()
  @ApiOperation({ summary: 'List document operation types' })
  @ApiOkResponse({ type: GetDocumentOperationTypesListDto })
  @ApiErrorsResponse()
  findAll(
    @Query() query: QueryDocumentOperationTypesDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.service.findAll(query, originalUrl);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document operation type by ID' })
  @ApiOkResponse({ type: GetDocumentOperationTypeResponseDto })
  @ApiErrorsResponse({ notFound: true })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.findOne(id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a document operation type' })
  @ApiOkResponse({ type: GetDocumentOperationTypeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentOperationType: ['manage'] })
  create(
    @Body() dto: CreateDocumentOperationTypeDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.create(dto, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a document operation type' })
  @ApiOkResponse({ type: GetDocumentOperationTypeResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  @RequireSystemPermission({ documentOperationType: ['manage'] })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentOperationTypeDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.update(id, dto, query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Void or purge a document operation type' })
  @ApiOkResponse({ type: GetDocumentOperationTypeResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ documentOperationType: ['manage'] })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteQueryDto,
  ) {
    return this.service.remove(id, query);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore a voided document operation type' })
  @ApiOkResponse({ type: GetDocumentOperationTypeResponseDto })
  @ApiErrorsResponse()
  @RequireSystemPermission({ documentOperationType: ['manage'] })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.service.restore(id, query);
  }
}
