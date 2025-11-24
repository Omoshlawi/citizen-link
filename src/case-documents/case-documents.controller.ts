import { Controller } from '@nestjs/common';
import { CaseDocumentsService } from './case-documents.service';

@Controller('documents/cases/:caseId/documents')
export class CaseDocumentsController {
  constructor(private readonly caseDocumentsService: CaseDocumentsService) {}
}
