import { Module } from '@nestjs/common';
import { CaseDocumentsService } from './case-documents.service';
import { CaseDocumentsController } from './case-documents.controller';

@Module({
  controllers: [CaseDocumentsController],
  providers: [CaseDocumentsService],
})
export class CaseDocumentsModule {}
