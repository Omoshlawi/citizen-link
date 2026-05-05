import { Module } from '@nestjs/common';
import { DocumentOperationTypesService } from './document-operation-types.service';
import { DocumentOperationTypesController } from './document-operation-types.controller';

@Module({
  controllers: [DocumentOperationTypesController],
  providers: [DocumentOperationTypesService],
  exports: [DocumentOperationTypesService],
})
export class DocumentOperationTypesModule {}
