import { Module } from '@nestjs/common';
import { DocumentExchangeController } from './document-exchange.controller';
import { DocumentExchangeInboundService } from './document-exchange.inbound.service';
import { DocumentExchangeOutboundService } from './document-exchange.outbound.service';
import { DocumentExchangeBidirectionService } from './document-exchange.bidirection.service';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [InvoiceModule],
  controllers: [DocumentExchangeController],
  providers: [
    DocumentExchangeInboundService,
    DocumentExchangeOutboundService,
    DocumentExchangeBidirectionService,
  ],
  exports: [
    DocumentExchangeInboundService,
    DocumentExchangeOutboundService,
    DocumentExchangeBidirectionService,
  ],
})
export class DocumentExchangeModule {}
