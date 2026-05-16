import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { DarajaConfig } from './daraja.config';
import { DarajaService } from './daraja.service';
import { DarajaController } from './daraja.controller';
import { PAYMENT_CALLBACKS_QUEUE } from '../payment/payment.constants';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: DarajaConfig) => ({ baseURL: config.baseUrl }),
      inject: [DarajaConfig],
    }),
    BullModule.registerQueue({ name: PAYMENT_CALLBACKS_QUEUE }),
  ],
  providers: [DarajaService],
  exports: [DarajaService],
  controllers: [DarajaController],
})
export class DarajaModule {}
