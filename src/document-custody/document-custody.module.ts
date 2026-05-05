import { Module } from '@nestjs/common';
import { HumanIdModule } from '../human-id/human-id.module';
import { DocumentCustodyController } from './document-custody.controller';
import { DocumentCustodyPermissionService } from './document-custody-permission.service';
import { DocumentCustodyService } from './document-custody.service';
import { DocumentCustodyTransitionsService } from './document-custody-transitions.service';

@Module({
  imports: [HumanIdModule],
  controllers: [DocumentCustodyController],
  providers: [
    DocumentCustodyPermissionService,
    DocumentCustodyTransitionsService,
    DocumentCustodyService,
  ],
  exports: [DocumentCustodyPermissionService, DocumentCustodyService],
})
export class DocumentCustodyModule {}
