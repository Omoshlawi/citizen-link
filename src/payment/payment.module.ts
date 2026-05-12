import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { MauzoModule } from 'src/mauzo/mauzo.module';
import { DarajaModule } from 'src/daraja/daraja.module';

@Module({
  imports: [DarajaModule, MauzoModule],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class PaymentModule {}
