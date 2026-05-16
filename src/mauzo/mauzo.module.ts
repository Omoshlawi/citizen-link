import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MauzoConfig } from './mauzo.config';
import { MauzoWebhookSignatureGuard } from './mauzo.guard';
import { MauzoService } from './mauzo.service';
import { MauzoWebHookService } from './mauzo.webhook.service';
import { MauzoController } from './mauzo.controller';
import { PAYMENT_CALLBACKS_QUEUE } from '../payment/payment.constants';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: MauzoConfig) => ({
        baseURL: config.baseUrl,
      }),
      inject: [MauzoConfig],
    }),
    BullModule.registerQueue({ name: PAYMENT_CALLBACKS_QUEUE }),
  ],
  controllers: [MauzoController],
  providers: [MauzoService, MauzoWebHookService, MauzoWebhookSignatureGuard],
  exports: [MauzoService],
})
export class MauzoModule {}
