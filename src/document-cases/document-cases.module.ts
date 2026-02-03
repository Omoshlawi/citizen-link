import { Module } from '@nestjs/common';
import { CaseStatusTransitionsModule } from '../case-status-transitions/case-status-transitions.module';
import { DocumentCasesController } from './document-cases.controller';
import { DocumentCasesService } from './document-cases.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { DocumentCaseGateway } from './document-case.gateway';
import { MatchingModule } from '../matching/matching.module';
import { DocumentCasesCreateService } from './document-cases.create.service';
import { DocumentCasesQueryService } from './document-cases.query.service';
import { DocumentCasesWorkflowService } from './documnt-cases.workflow.service';

@Module({
  imports: [
    CaseStatusTransitionsModule,
    CaseStatusTransitionsModule,
    ExtractionModule,
    MatchingModule,
  ],
  controllers: [DocumentCasesController],
  providers: [
    DocumentCasesService,
    DocumentCasesCreateService,
    DocumentCasesQueryService,
    DocumentCasesWorkflowService,
    DocumentCaseGateway,
  ],
})
export class DocumentCasesModule {}
