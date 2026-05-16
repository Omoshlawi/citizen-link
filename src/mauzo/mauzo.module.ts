import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MauzoConfig } from './mauzo.config';
import { MauzoWebhookSignatureGuard } from './mauzo.guard';
import { MauzoService } from './mauzo.service';
import { MauzoWebHookService } from './mauzo.webhook.service';
import { MauzoController } from './mauzo.controller';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: MauzoConfig) => ({
        baseURL: config.baseUrl,
      }),
      inject: [MauzoConfig],
    }),
  ],
  controllers: [MauzoController],
  providers: [MauzoService, MauzoWebHookService, MauzoWebhookSignatureGuard],
  exports: [MauzoService],
})
export class MauzoModule {}
