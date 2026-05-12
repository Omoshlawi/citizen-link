import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MauzoConfig } from './mauzo.config';
import { MauzoService } from './mauzo.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: MauzoConfig) => ({
        baseURL: config.baseUrl,
      }),
      inject: [MauzoConfig],
    }),
  ],
  controllers: [],
  providers: [MauzoService],
})
export class MauzoModule {}
