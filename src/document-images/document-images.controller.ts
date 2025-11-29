import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from 'src/app.decorators';
import {
  CustomRepresentationQueryDto,
  DeleteQueryDto,
} from 'src/query-builder/query-builder.utils';
import { OriginalUrl } from '../query-builder';
import {
  GetDocumentImageResponseDto,
  QueryDocumentImageDto,
} from './document-images.dto';
import { DocumentImagesService } from './document-images.service';

@Controller('documents/cases/:caseId/documents/:documentId/images')
export class DocumentImagesController {
  constructor(private readonly documentImagesService: DocumentImagesService) {}

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

  @Delete(':imageId')
  @ApiOperation({ summary: 'Delete Image' })
  @ApiOkResponse({ type: GetDocumentImageResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  remove(
    @Param('imageId') imageId: string,
    @Query() query: DeleteQueryDto,
    @Param('caseId') caseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentImagesService.remove(
      imageId,
      query,
      caseId,
      documentId,
    );
  }

  @Post(':imageId/restore')
  @ApiOperation({ summary: 'Restore Image' })
  @ApiOkResponse({ type: GetDocumentImageResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  restore(
    @Param('imageId') imageId: string,
    @Query() query: CustomRepresentationQueryDto,
    @Param('caseId') caseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentImagesService.restore(
      imageId,
      query,
      caseId,
      documentId,
    );
  }
}
