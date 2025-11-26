import { Module } from '@nestjs/common';
import { AddressLocalesService } from './address-locales.service';
import { AddressLocalesController } from './address-locales.controller';

@Module({
  providers: [AddressLocalesService],
  controllers: [AddressLocalesController],
  exports: [AddressLocalesService],
})
export class AddressLocalesModule {}
