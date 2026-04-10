import { Module } from '@nestjs/common';
import { HumanIdModule } from '../human-id/human-id.module';
import { DocumentCustodyController } from './document-custody.controller';
import { DocumentCustodyOperationsService } from './document-custody-operations.service';
import { DocumentCustodyPermissionService } from './document-custody-permission.service';
import { DocumentCustodyQueryService } from './document-custody-query.service';
import { DocumentOperationTypeController } from './document-operation-type/document-operation-type.controller';
import { DocumentOperationTypeService } from './document-operation-type/document-operation-type.service';
import { StationOperationTypeController } from './document-operation-type/station-operation-type.controller';
import { StationOperationTypeService } from './document-operation-type/station-operation-type.service';
import { AuditOperationService } from './operations/audit.operation.service';
import { ConditionUpdateOperationService } from './operations/condition-update.operation.service';
import { CustodyOperationHelperService } from './operations/custody-operation-helper.service';
import { DisposalOperationService } from './operations/disposal.operation.service';
import { HandoverOperationService } from './operations/handover.operation.service';
import { ReceiveOperationService } from './operations/receive.operation.service';
import { RequisitionOperationService } from './operations/requisition.operation.service';
import { ReturnOperationService } from './operations/return.operation.service';
import { TransferOperationService } from './operations/transfer.operation.service';
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
    // Shared infrastructure
    DocumentCustodyPermissionService,
    CustodyOperationHelperService,

    // Individual operation services
    ReceiveOperationService,
    TransferOperationService,
    RequisitionOperationService,
    HandoverOperationService,
    DisposalOperationService,
    ReturnOperationService,
    AuditOperationService,
    ConditionUpdateOperationService,

    // Aggregator + query
    DocumentCustodyOperationsService,
    DocumentCustodyQueryService,

    // Operation type management
    DocumentOperationTypeService,
    StationOperationTypeService,

    // Staff grants
    StaffStationOperationService,
  ],
  exports: [
    DocumentCustodyPermissionService,
    DocumentCustodyOperationsService,
    DocumentCustodyQueryService,
  ],
})
export class DocumentCustodyModule {}
