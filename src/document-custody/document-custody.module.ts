import { Module } from '@nestjs/common';
import { HumanIdModule } from '../human-id/human-id.module';
import { DocumentCustodyController } from './document-custody.controller';
import { DocumentCustodyPermissionService } from './document-custody-permission.service';
import { DocumentCustodyService } from './document-custody.service';
import { DocumentCustodyTransitionsService } from './document-custody-transitions.service';
import { DocumentOperationTypeController } from './document-operation-type/document-operation-type.controller';
import { DocumentOperationTypeService } from './document-operation-type/document-operation-type.service';
import { StationOperationTypeController } from './document-operation-type/station-operation-type.controller';
import { StationOperationTypeService } from './document-operation-type/station-operation-type.service';
import { StaffStationOperationController } from './staff-station-operation/staff-station-operation.controller';
import { StaffStationOperationService } from './staff-station-operation/staff-station-operation.service';

@Module({
  imports: [HumanIdModule],
  controllers: [
    DocumentCustodyController,
    DocumentOperationTypeController,
    StationOperationTypeController,
    StaffStationOperationController,
  ],
  providers: [
    DocumentCustodyPermissionService,
    DocumentCustodyTransitionsService,
    DocumentCustodyService,
    DocumentOperationTypeService,
    StationOperationTypeService,
    StaffStationOperationService,
  ],
  exports: [DocumentCustodyPermissionService, DocumentCustodyService],
})
export class DocumentCustodyModule {}
