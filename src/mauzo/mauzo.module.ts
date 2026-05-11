import { Module } from '@nestjs/common';
import { MauzoController } from './mauzo.controller';
import { MauzoService } from './mauzo.service';
import { HttpModule } from '@nestjs/axios';
import { MauzoConfig } from './mauzo.config';

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
  providers: [MauzoService],
})
export class MauzoModule {}
