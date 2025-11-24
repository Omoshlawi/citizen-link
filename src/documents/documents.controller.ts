import { Controller } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents/reports/:reportId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}
}
