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
import { DocumentCasesModule } from './document-cases/document-cases.module';
import { DocumentImagesModule } from './document-images/document-images.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { ExtractionModule } from './extraction/extraction.module';
import { HumanIdConfig } from './human-id/human-id.config';
import { HumanIdModule } from './human-id/human-id.module';
import { InvoiceModule } from './invoice/invoice.module';
import { MatchingModule } from './matching/matching.module';
import { PickupStationsModule } from './pickup-stations/pickup-stations.module';
import { PrismaConfig } from './prisma/prisma.config';
import { PrismaModule } from './prisma/prisma.module';
import { PromptsModule } from './prompts/prompts.module';
import { S3Module } from './s3/s3.module';
import { StatusTransitionsModule } from './status-transitions/status-transitions.module';
import { VisionModule } from './vision/vision.module';

@Module({
  imports: [
    PromptsModule,
    ConfigifyModule.forRootAsync(),
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
    MatchingModule,
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
