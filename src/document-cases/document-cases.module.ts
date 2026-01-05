import { Module } from '@nestjs/common';
import { CaseStatusTransitionsModule } from '../case-status-transitions/case-status-transitions.module';
import { DocumentCasesController } from './document-cases.controller';
import { DocumentCasesService } from './document-cases.service';
import { DocumentCaseGateway } from './document-case.gateway';

@Module({
  imports: [CaseStatusTransitionsModule, CaseStatusTransitionsModule],
  controllers: [DocumentCasesController],
  providers: [DocumentCasesService, DocumentCaseGateway],
})
export class DocumentCasesModule {}
