import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { CustomRepresentationQueryDto } from '../query-builder/query-builder.utils';
import { OriginalUrl } from '../query-builder';
import {
  CreateDocumentImageDto,
  GetDocumentImageResponseDto,
  QueryDocumentImageDto,
  CreateDocumentImageResponseDto,
} from './document-images.dto';
import { DocumentImagesService } from './document-images.service';

@Controller('documents/cases/:caseId/documents/:documentId/images')
export class DocumentImagesController {
  constructor(private readonly documentImagesService: DocumentImagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create Image' })
  @ApiOkResponse({ type: CreateDocumentImageResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  create(
    @Body() createDocumentImageDto: CreateDocumentImageDto,
    @Query() query: CustomRepresentationQueryDto,
    @Param('caseId') caseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentImagesService.create(
      createDocumentImageDto,
      caseId,
      documentId,
      query,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get Images' })
  @ApiOkResponse({ type: GetDocumentImageResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findAll(
    @Param('caseId') caseId: string,
    @Param('documentId') documentId: string,
    @Query() query: QueryDocumentImageDto,
    @OriginalUrl() originalUrl: string,
  ) {
    return this.documentImagesService.findAll(
      query,
      originalUrl,
      caseId,
      documentId,
    );
  }

  @Get(':imageId')
  @ApiOperation({ summary: 'Get Image' })
  @ApiOkResponse({ type: GetDocumentImageResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findOne(
    @Param('imageId') imageId: string,
    @Query() query: CustomRepresentationQueryDto,
    @Param('caseId') caseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentImagesService.findOne(
      imageId,
      query,
      caseId,
      documentId,
    );
  }
}
