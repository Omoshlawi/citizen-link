import { Module } from '@nestjs/common';
import { DarajaConfig } from './daraja.config';
import { DarajaService } from './daraja.service';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

@Module({
  controllers: [TransactionController],
  providers: [DarajaConfig, DarajaService, TransactionService],
  exports: [TransactionService, DarajaService],
})
export class PaymentModule {}
