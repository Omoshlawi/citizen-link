import {
  Controller,
  Param,
  Post,
  Query,
  Body,
  Patch,
  Delete,
  Get,
} from '@nestjs/common';
import { CaseDocumentsService } from './case-documents.service';
import { CustomRepresentationQueryDto, DeleteQueryDto } from '../query-builder';
import {
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import {
  CreateCaseDocumentDto,
  GetCaseDocumentResponseDto,
  UpdateCaseDocumentDto,
} from './case-documents.dto';

@Controller('documents/cases/:caseId/documents')
export class CaseDocumentsController {
  constructor(private readonly caseDocumentsService: CaseDocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create Document' })
  @ApiCreatedResponse({ type: GetCaseDocumentResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  create(
    @Param('caseId') caseId: string,
    @Body() createCaseDocumentDto: CreateCaseDocumentDto,
    @Query() query: CustomRepresentationQueryDto,
  ) {
    return this.caseDocumentsService.create(
      createCaseDocumentDto,
      query,
      caseId,
    );
  }

  @Get(':documentId')
  @ApiOperation({ summary: 'Get Document' })
  @ApiOkResponse({ type: GetCaseDocumentResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  findOne(
    @Param('documentId') documentId: string,
    @Query() query: CustomRepresentationQueryDto,
    @Param('caseId') caseId: string,
  ) {
    return this.caseDocumentsService.findOne(documentId, query, caseId);
  }

  @Patch(':documentId')
  @ApiOperation({ summary: 'Update Document' })
  @ApiOkResponse({ type: GetCaseDocumentResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  update(
    @Param('documentId') documentId: string,
    @Body() updateCaseDocumentDto: UpdateCaseDocumentDto,
    @Query() query: CustomRepresentationQueryDto,
    @Param('caseId') caseId: string,
  ) {
    return this.caseDocumentsService.update(
      documentId,
      updateCaseDocumentDto,
      query,
      caseId,
    );
  }

  @Delete(':documentId')
  @ApiOperation({ summary: 'Delete Document' })
  @ApiOkResponse({ type: GetCaseDocumentResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  delete(
    @Param('documentId') documentId: string,
    @Query() query: DeleteQueryDto,
    @Param('caseId') caseId: string,
  ) {
    return this.caseDocumentsService.remove(documentId, query, caseId);
  }

  @Post(':documentId/restore')
  @ApiOperation({ summary: 'Restore Document' })
  @ApiOkResponse({ type: GetCaseDocumentResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  restore(
    @Param('documentId') documentId: string,
    @Query() query: CustomRepresentationQueryDto,
    @Param('caseId') caseId: string,
  ) {
    return this.caseDocumentsService.restore(documentId, query, caseId);
  }
}
