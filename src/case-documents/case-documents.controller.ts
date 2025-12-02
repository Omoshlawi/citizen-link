import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { CustomRepresentationQueryDto } from '../query-builder';
import {
  GetCaseDocumentResponseDto,
  UpdateCaseDocumentDto,
} from './case-documents.dto';
import { CaseDocumentsService } from './case-documents.service';

@Controller('documents/cases/:caseId/documents')
export class CaseDocumentsController {
  constructor(private readonly caseDocumentsService: CaseDocumentsService) {}
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
}
