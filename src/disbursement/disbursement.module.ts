import { Module } from '@nestjs/common';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';
import { PaymentModule } from '../payment/payment.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [PaymentModule, WalletModule],
  controllers: [DisbursementController],
  providers: [DisbursementService],
  exports: [DisbursementService],
})
export class DisbursementModule {}
