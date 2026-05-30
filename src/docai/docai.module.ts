import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { DocaiAdminController } from './docai-admin.controller';
import { DocaiEmbeddingService } from './docai-embedding.service';
import { DocaiWebhookController } from './docai-webhook.controller';
import { DocaiWebhookService } from './docai-webhook.service';
import { DocaiConfig } from './docai.config';
import { DocaiService } from './docai.service';

// S3Module and NotificationsModule are @Global() — no need to import here.
// PrismaModule is @Global() — PrismaService is injectable without a local import.

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
  providers: [DocaiService, DocaiWebhookService, DocaiEmbeddingService],
  exports: [DocaiService, DocaiEmbeddingService],
  controllers: [DocaiWebhookController, DocaiAdminController],
})
export class DocaiModule {}
