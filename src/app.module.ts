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
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    ConfigifyModule.forRootAsync(),
    PrismaModule,
    QueryBuilderModule.register({ global: true }),
    ScheduleModule.forRoot(),
    AuthModule.forRoot(),
    CustomerModule,
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
