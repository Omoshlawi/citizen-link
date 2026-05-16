import { Injectable } from '@nestjs/common';
import { UserSession } from '../auth/auth.types';
import { CustomRepresentationQueryDto } from '../common/query-builder';
import { DocumentExchangeCodeCancelService } from './document-exchange.code-cancel.service';
import { DocumentExchangeCodeIssueService } from './document-exchange.code-issue.service';
import { DocumentExchangeCodeVerifyService } from './document-exchange.code-verify.service';
import { DocumentExchangeDeliveryService } from './document-exchange.delivery.service';
import {
  CancelCodeQueryDto,
  CancelExchangeDto,
  CancelVerificationDto,
  GetDeliveryLabelQueryDto,
  IssueCodeQueryDto,
  QueryExchangeDto,
  ScheduleInboundExchangeDto,
  ScheduleOutboundExchangeDto,
  UpdateOutboundExchangeDto,
  VerifyCodeQueryDto,
  VerifyExchangeCodeDto,
  WithdrawScheduleQueryDto,
} from './document-exchange.dto';
import { DocumentExchangeInboundService } from './document-exchange.inbound.service';
import { DocumentExchangeLabelService } from './document-exchange.label.service';
import { DocumentExchangeOutboundService } from './document-exchange.outbound.service';
import { DocumentExchangePolicyService } from './document-exchange.policy.service';
import { DocumentExchangeQueryService } from './document-exchange.query.service';
import { DocumentExchangeWithdrawService } from './document-exchange.withdraw.service';

/**
 * Single entry point for the document exchange domain.
 * All sub-services are internal to the module — callers inject only this class.
 */
@Injectable()
export class DocumentExchangeService {
  constructor(
    private readonly query: DocumentExchangeQueryService,
    private readonly inbound: DocumentExchangeInboundService,
    private readonly outbound: DocumentExchangeOutboundService,
    private readonly withdraw: DocumentExchangeWithdrawService,
    private readonly codeIssue: DocumentExchangeCodeIssueService,
    private readonly codeVerify: DocumentExchangeCodeVerifyService,
    private readonly codeCancel: DocumentExchangeCodeCancelService,
    private readonly delivery: DocumentExchangeDeliveryService,
    private readonly label: DocumentExchangeLabelService,
    private readonly policy: DocumentExchangePolicyService,
  ) {}

  // ── Queries ──────────────────────────────────────────────────────────────

  findAll(
    query: QueryExchangeDto,
    originalUrl: string,
    user: UserSession['user'],
  ) {
    return this.query.findAll(query, originalUrl, user);
  }

  findOne(
    id: string,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.query.findOne(id, query, user);
  }

  // ── Scheduling ───────────────────────────────────────────────────────────

  scheduleInbound(dto: ScheduleInboundExchangeDto, userSession: UserSession) {
    return this.inbound.scheduleExchange(dto, userSession);
  }

  getActiveInboundState(foundCaseId: string, user: UserSession['user']) {
    return this.inbound.getActiveExchangeState(foundCaseId, user);
  }

  scheduleOutbound(
    dto: ScheduleOutboundExchangeDto,
    query: CustomRepresentationQueryDto,
    user: UserSession['user'],
  ) {
    return this.outbound.scheduleExchange(dto, query, user);
  }

  updateOutbound(dto: UpdateOutboundExchangeDto, user: UserSession['user']) {
    return this.outbound.updateExchange(dto, user);
  }

  withDraw(
    query: WithdrawScheduleQueryDto,
    dto: CancelExchangeDto,
    user: UserSession['user'],
  ) {
    return this.withdraw.withDraw(query, dto, user);
  }

  // ── Code lifecycle ────────────────────────────────────────────────────────

  issueCode(query: IssueCodeQueryDto, user: UserSession['user']) {
    return this.codeIssue.issueCode(query, user);
  }

  verifyCode(
    query: VerifyCodeQueryDto,
    dto: VerifyExchangeCodeDto,
    userSession: UserSession,
  ) {
    return this.codeVerify.verifyCode(query, dto, userSession);
  }

  cancelCode(
    query: CancelCodeQueryDto,
    dto: CancelVerificationDto,
    user: UserSession['user'],
  ) {
    return this.codeCancel.cancelCode(query, dto, user);
  }

  // ── Delivery ──────────────────────────────────────────────────────────────

  confirmDelivery(code: string, user: UserSession['user']) {
    return this.delivery.confirmDelivery(code, user);
  }

  failDelivery(
    exchangeNumber: string,
    reason: string,
    user: UserSession['user'],
  ) {
    return this.delivery.failDelivery(exchangeNumber, reason, user);
  }

  getDeliveryLabel(dto: GetDeliveryLabelQueryDto) {
    return this.label.getLabel(dto);
  }

  getDeliveryPolicy() {
    return this.policy.getPolicy();
  }
}
