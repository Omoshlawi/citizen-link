import { Module } from '@nestjs/common';
import { CaseStatusTransitionsModule } from '../case-status-transitions/case-status-transitions.module';
import { DocumentCasesController } from './document-cases.controller';
import { DocumentCasesService } from './document-cases.service';

@Module({
  imports: [CaseStatusTransitionsModule, CaseStatusTransitionsModule],
  controllers: [DocumentCasesController],
  providers: [DocumentCasesService],
})
export class DocumentCasesModule {}
