import { ConfigifyModule } from '@itgorillaz/configify';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ZodValidationPipe } from 'nestjs-zod';
import { AddressHierarchyModule } from './address-hierarchy/address-hierarchy.module';
import { AddressLocalesModule } from './address-locales/address-locales.module';
import { AddressModule } from './address/address.module';
import { AiConfig } from './ai/ai.config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { ZodValidationExceptionFilter } from './app.exceptionfilter';
import { AppService } from './app.service';
import { RequireSystemPermissionsGuard } from './auth/auth.guards';
import { AuthModule } from './auth/auth.module';
import { CaseDocumentsModule } from './case-documents/case-documents.module';
import { DocumentCasesModule } from './document-cases/document-cases.module';
import { DocumentImagesModule } from './document-images/document-images.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueryBuilderModule } from './query-builder';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [
    ConfigifyModule.forRootAsync(),
    PrismaModule,
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
    AiModule.registerAsync({
      global: true,
      useFactory: (config: AiConfig) => {
        return {
          geminiApiKey: config.geminiApiKey,
          model: 'gemini-2.0-flash-001',
        };
      },
      inject: [AiConfig],
    }),
    DocumentImagesModule,
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
