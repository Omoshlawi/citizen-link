import { Module } from '@nestjs/common';
import { DocumentCasesService } from './document-cases.service';
import { DocumentCasesController } from './document-cases.controller';

@Module({
  controllers: [DocumentCasesController],
  providers: [DocumentCasesService],
})
export class DocumentCasesModule {}
