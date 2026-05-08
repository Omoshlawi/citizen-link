import { Module } from '@nestjs/common';
import { DocumentExchangeController } from './document-exchange.controller';
import { DocumentExchangeInboundService } from './document-exchange.inbound.service';
import { DocumentExchangeOutboundService } from './document-exchange.outbound.service';

@Module({
  controllers: [DocumentExchangeController],
  providers: [DocumentExchangeInboundService, DocumentExchangeOutboundService],
  exports: [DocumentExchangeInboundService, DocumentExchangeOutboundService],
})
export class DocumentExchangeModule {}
