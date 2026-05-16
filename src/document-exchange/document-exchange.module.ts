import { Module } from '@nestjs/common';
import { InvoiceModule } from '../invoice/invoice.module';
import { DocumentExchangeCodeCancelService } from './document-exchange.code-cancel.service';
import { DocumentExchangeCodeIssueService } from './document-exchange.code-issue.service';
import { DocumentExchangeCodeVerifyService } from './document-exchange.code-verify.service';
import { DocumentExchangeController } from './document-exchange.controller';
import { DocumentExchangeDeliveryService } from './document-exchange.delivery.service';
import { DocumentExchangeInboundService } from './document-exchange.inbound.service';
import { DocumentExchangeLabelService } from './document-exchange.label.service';
import { DocumentExchangeOutboundService } from './document-exchange.outbound.service';
import { DocumentExchangePolicyService } from './document-exchange.policy.service';
import { DocumentExchangeQueryService } from './document-exchange.query.service';
import { DocumentExchangeService } from './document-exchange.service';
import { DocumentExchangeWithdrawService } from './document-exchange.withdraw.service';

@Module({
  imports: [InvoiceModule],
  controllers: [DocumentExchangeController],
  providers: [
    // Facade — the only service controllers and external code should touch
    DocumentExchangeService,
    // Internal sub-services
    DocumentExchangeQueryService,
    DocumentExchangeWithdrawService,
    DocumentExchangeCodeIssueService,
    DocumentExchangeCodeVerifyService,
    DocumentExchangeCodeCancelService,
    DocumentExchangeInboundService,
    DocumentExchangeOutboundService,
    DocumentExchangeDeliveryService,
    DocumentExchangeLabelService,
    DocumentExchangePolicyService,
  ],
  exports: [DocumentExchangeService],
})
export class DocumentExchangeModule {}
