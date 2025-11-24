import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigifyModule } from '@itgorillaz/configify';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { QueryBuilderModule } from './query-builder';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { RequireSystemPermissionsGuard } from './auth/auth.guards';
import { ZodValidationPipe } from 'nestjs-zod';
import { ZodValidationExceptionFilter } from './app.exceptionfilter';
import { AddressHierarchyModule } from './address-hierarchy/address-hierarchy.module';
import { AddressModule } from './address/address.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { CaseDocumentsModule } from './case-documents/case-documents.module';
import { DocumentCasesModule } from './document-cases/document-cases.module';
import { S3Module } from './s3/s3.module';
import { AiModule } from './ai/ai.module';
import { AiConfig } from './ai/ai.config';

@Module({
  imports: [
    ConfigifyModule.forRootAsync(),
    PrismaModule,
    QueryBuilderModule.register({ global: true }),
    ScheduleModule.forRoot(),
    AuthModule.forRoot(),
    AddressHierarchyModule,
    AddressModule,
    DocumentTypesModule,
    CaseDocumentsModule,
    DocumentCasesModule,
    S3Module,
    AiModule.registerAsync({
      global: true,
      useFactory: (config: AiConfig) => {
        return {
          googleApiKey: config.googleApiKey,
          model: 'gemini-2.0-flash-001',
        };
      },
      inject: [AiConfig],
    }),
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
