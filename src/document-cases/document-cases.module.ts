import { Module } from '@nestjs/common';
import { CaseStatusTransitionsModule } from '../case-status-transitions/case-status-transitions.module';
import { DocumentCasesController } from './document-cases.controller';
import { DocumentCasesService } from './document-cases.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { DocumentCaseGateway } from './document-case.gateway';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [
    CaseStatusTransitionsModule,
    CaseStatusTransitionsModule,
    ExtractionModule,
    MatchingModule,
  ],
  controllers: [DocumentCasesController],
  providers: [DocumentCasesService, DocumentCaseGateway],
})
export class DocumentCasesModule {}
