import { ConfigifyModule } from '@itgorillaz/configify';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaPg } from '@prisma/adapter-pg';
import { ZodValidationPipe } from 'nestjs-zod';
import { AddressHierarchyModule } from './address-hierarchy/address-hierarchy.module';
import { AddressLocalesModule } from './address-locales/address-locales.module';
import { AddressModule } from './address/address.module';
import { AppController } from './app.controller';
import { ZodValidationExceptionFilter } from './app.exceptionfilter';
import { AppService } from './app.service';
import { RequireSystemPermissionsGuard } from './auth/auth.guards';
import { AuthModule } from './auth/auth.module';
import { CaseDocumentsModule } from './case-documents/case-documents.module';
import { ChatBotModule } from './chat-bot/chat-bot.module';
import { ClaimModule } from './claim/claim.module';
import { QueryBuilderModule } from './common/query-builder';
import { SettingsModule } from './common/settings';
import { TemplatesModule } from './common/templates';
import { DocumentCasesModule } from './document-cases/document-cases.module';
import { DocumentImagesModule } from './document-images/document-images.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { EmbeddingConfig } from './embedding/embedding.config';
import { EmbeddingModule } from './embedding/embedding.module';
import { ExtractionModule } from './extraction/extraction.module';
import { HumanIdConfig } from './human-id/human-id.config';
import { HumanIdModule } from './human-id/human-id.module';
import { InvoiceModule } from './invoice/invoice.module';
import { MatchingConfig } from './matching/matching.config';
import { MatchingModule } from './matching/matching.module';
import {
  EmailProviders,
  PushProviders,
  SmsProviders,
} from './notifications/notification.interfaces';
import { NotificationsModule } from './notifications/notifications.module';
import { PickupStationsModule } from './pickup-stations/pickup-stations.module';
import { PrismaConfig } from './prisma/prisma.config';
import { PrismaModule } from './prisma/prisma.module';
import { PromptsModule } from './prompts/prompts.module';
import { PushTokenModule } from './push-token/push-token.module';
import { QueueModule } from './queue/queue.module';
import { S3Module } from './s3/s3.module';
import { StatusTransitionsModule } from './status-transitions/status-transitions.module';
import { VisionModule } from './vision/vision.module';
import { ExpoSdkModule } from './expo-sdk/expo-sdk.module';

@Module({
  imports: [
    PromptsModule,
    ConfigifyModule.forRootAsync({}),
    PrismaModule.forRootAsync({
      global: true,
      useFactory: (config: PrismaConfig) => {
        return {
          adapter: new PrismaPg({ connectionString: config.databaseUrl }),
        };
      },
      inject: [PrismaConfig],
    }),
    QueryBuilderModule.register({ global: true }),
    ScheduleModule.forRoot(),
    AuthModule.forRoot(),
    AddressHierarchyModule,
    AddressModule,
    AddressLocalesModule,
    DocumentTypesModule,
    CaseDocumentsModule,
    DocumentCasesModule,
    S3Module,
    DocumentImagesModule,
    ExtractionModule,
    MatchingModule.registerAsync({
      useFactory: (config: MatchingConfig) => {
        // Ensure weights add up to 1
        const sum = config.weightVector + config.weightExact + config.weightAi;
        if (sum !== 1) {
          throw new Error('Weights must add up to 1');
        }
        return {
          weights: {
            vector: config.weightVector,
            exact: config.weightExact,
            ai: config.weightAi,
          },
          vectorSimilarityThreshold: config.vectorSimilarityThreshold,
          topNCandidates: config.topNCandidates,
          exactMatchThreshold: config.exactMatchThreshold,
          aiMatchThreshold: config.aiMatchThreshold,
          minimumFinalScore: config.minimumFinalScore,
          autoConfirmThreshold: config.autoConfirmThreshold,
          maxSecurityQuestions: config.maxSecurityQuestions,
        };
      },
      inject: [MatchingConfig],
    }),
    ChatBotModule,
    PickupStationsModule,
    ClaimModule,
    StatusTransitionsModule,
    HumanIdModule.registerAsync({
      global: true,
      useFactory: (config: HumanIdConfig) => {
        return {
          paddingLength: config.paddingLength,
        };
      },
      inject: [HumanIdConfig],
    }),
    InvoiceModule,
    VisionModule,
    EmbeddingModule.registerAsync({
      useFactory: (config: EmbeddingConfig) => {
        return {
          model: config.model,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          isOpenAi: config.isOpenAi,
        };
      },
      inject: [EmbeddingConfig],
    }),
    QueueModule,
    NotificationsModule.register({
      global: true,
      options: {
        emailProviders: [EmailProviders.SENDGRID],
        smsProviders: [SmsProviders.TWILIO, SmsProviders.AFRICASTALK],
        pushProviders: [PushProviders.EXPO],
      },
    }),
    SettingsModule,
    TemplatesModule,
    PushTokenModule,
    QueueModule,
    ExpoSdkModule.register(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: RequireSystemPermissionsGuard },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: ZodValidationExceptionFilter,
    },
  ],
})
export class AppModule {}
