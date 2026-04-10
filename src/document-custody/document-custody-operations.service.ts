import { Injectable } from '@nestjs/common';
import { UserSession } from '../auth/auth.types';
import {
  ConfirmTransferDto,
  CreateRequisitionDto,
  InitiateTransferDto,
  RecordAuditDto,
  RecordConditionUpdateDto,
  RecordDisposalDto,
  RecordHandoverDto,
  RecordReceivedDto,
  RecordReturnDto,
} from './document-custody.dto';
import { AuditOperationService } from './operations/audit.operation.service';
import { ConditionUpdateOperationService } from './operations/condition-update.operation.service';
import { DisposalOperationService } from './operations/disposal.operation.service';
import { HandoverOperationService } from './operations/handover.operation.service';
import { ReceiveOperationService } from './operations/receive.operation.service';
import { RequisitionOperationService } from './operations/requisition.operation.service';
import { ReturnOperationService } from './operations/return.operation.service';
import { TransferOperationService } from './operations/transfer.operation.service';

@Injectable()
export class DocumentCustodyOperationsService {
  constructor(
    private readonly receiveOp: ReceiveOperationService,
    private readonly transferOp: TransferOperationService,
    private readonly requisitionOp: RequisitionOperationService,
    private readonly handoverOp: HandoverOperationService,
    private readonly disposalOp: DisposalOperationService,
    private readonly returnOp: ReturnOperationService,
    private readonly auditOp: AuditOperationService,
    private readonly conditionUpdateOp: ConditionUpdateOperationService,
  ) {}

  recordReceived(
    foundCaseId: string,
    dto: RecordReceivedDto,
    user: UserSession['user'],
  ) {
    return this.receiveOp.execute(foundCaseId, dto, user);
  }

  initiateTransfer(
    foundCaseId: string,
    dto: InitiateTransferDto,
    user: UserSession['user'],
  ) {
    return this.transferOp.initiate(foundCaseId, dto, user);
  }

  confirmTransfer(
    foundCaseId: string,
    dto: ConfirmTransferDto,
    user: UserSession['user'],
  ) {
    return this.transferOp.confirm(foundCaseId, dto, user);
  }

  createRequisition(
    foundCaseId: string,
    dto: CreateRequisitionDto,
    user: UserSession['user'],
  ) {
    return this.requisitionOp.execute(foundCaseId, dto, user);
  }

  recordHandover(
    foundCaseId: string,
    dto: RecordHandoverDto,
    user: UserSession['user'],
  ) {
    return this.handoverOp.execute(foundCaseId, dto, user);
  }

  recordDisposal(
    foundCaseId: string,
    dto: RecordDisposalDto,
    user: UserSession['user'],
  ) {
    return this.disposalOp.execute(foundCaseId, dto, user);
  }

  recordReturn(
    foundCaseId: string,
    dto: RecordReturnDto,
    user: UserSession['user'],
  ) {
    return this.returnOp.execute(foundCaseId, dto, user);
  }

  recordAudit(
    foundCaseId: string,
    dto: RecordAuditDto,
    user: UserSession['user'],
  ) {
    return this.auditOp.execute(foundCaseId, dto, user);
  }

  recordConditionUpdate(
    foundCaseId: string,
    dto: RecordConditionUpdateDto,
    user: UserSession['user'],
  ) {
    return this.conditionUpdateOp.execute(foundCaseId, dto, user);
  }
}
