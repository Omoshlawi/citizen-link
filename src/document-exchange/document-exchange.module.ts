import { Module } from '@nestjs/common';
import { InvoiceModule } from '../invoice/invoice.module';
import { DocumentExchangeBidirectionService } from './document-exchange.bidirection.service';
import { DocumentExchangeController } from './document-exchange.controller';
import { DocumentExchangeDeliveryService } from './document-exchange.delivery.service';
import { DocumentExchangeInboundService } from './document-exchange.inbound.service';
import { DocumentExchangeLabelService } from './document-exchange.label.service';
import { DocumentExchangeOutboundService } from './document-exchange.outbound.service';
import { DocumentExchangePolicyService } from './document-exchange.policy.service';

@Module({
  imports: [InvoiceModule],
  controllers: [DocumentExchangeController],
  providers: [
    DocumentExchangeInboundService,
    DocumentExchangeOutboundService,
    DocumentExchangeBidirectionService,
    DocumentExchangeDeliveryService,
    DocumentExchangeLabelService,
    DocumentExchangePolicyService,
  ],
  exports: [
    DocumentExchangeInboundService,
    DocumentExchangeOutboundService,
    DocumentExchangeBidirectionService,
    DocumentExchangeDeliveryService,
    DocumentExchangePolicyService,
  ],
})
export class DocumentExchangeModule {}
