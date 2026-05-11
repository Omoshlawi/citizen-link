import { Module } from '@nestjs/common';
import { DarajaService } from './daraja.service';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { MauzoModule } from 'src/mauzo/mauzo.module';

@Module({
  imports: [MauzoModule],
  controllers: [TransactionController],
  providers: [DarajaService, TransactionService],
  exports: [TransactionService, DarajaService],
})
export class PaymentModule {}
