import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DarajaConfig } from './daraja.config';
import { DarajaService } from './daraja.service';
import { DarajaController } from './daraja.controller';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: DarajaConfig) => ({ baseURL: config.baseUrl }),
      inject: [DarajaConfig],
    }),
  ],
  providers: [DarajaService],
  exports: [DarajaService],
  controllers: [DarajaController],
})
export class DarajaModule {}
