import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DocaiWebhookController } from './docai-webhook.controller';
import { DocaiWebhookService } from './docai-webhook.service';
import { DocaiConfig } from './docai.config';
import { DocaiService } from './docai.service';

// S3Module and NotificationsModule are @Global() — no need to import here.

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [DocaiConfig],
      useFactory: (config: DocaiConfig) => ({
        baseURL: config.serviceUrl,
        headers: { 'X-Internal-Secret': config.serviceInternalSecret },
        timeout: 10_000,
      }),
    }),
  ],
  providers: [DocaiService, DocaiWebhookService],
  exports: [DocaiService],
  controllers: [DocaiWebhookController],
})
export class DocaiModule {}
