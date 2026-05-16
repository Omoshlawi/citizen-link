import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { PaymentCallbackProcessor } from './payment-callback.processor';
import { PAYMENT_CALLBACKS_QUEUE } from './payment.constants';
import { MauzoModule } from 'src/mauzo/mauzo.module';
import { DarajaModule } from 'src/daraja/daraja.module';

@Module({
  imports: [
    DarajaModule,
    MauzoModule,
    BullModule.registerQueue({ name: PAYMENT_CALLBACKS_QUEUE }),
    BullBoardModule.forFeature({
      name: PAYMENT_CALLBACKS_QUEUE,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [TransactionController],
  providers: [TransactionService, PaymentCallbackProcessor],
  exports: [TransactionService],
})
export class PaymentModule {}
