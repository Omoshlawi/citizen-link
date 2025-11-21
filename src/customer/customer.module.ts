import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    // Sample notification configuration
    NotificationModule.register({
      apiKey: process.env.SMS_API_KEY || '',
      apiSecret: process.env.SMS_API_SECRET || '',
      provider: process.env.SMS_PROVIDER || '',
    }),
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
