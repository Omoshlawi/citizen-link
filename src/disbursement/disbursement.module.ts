import { Module } from '@nestjs/common';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';
import { DarajaModule } from '../daraja/daraja.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [DarajaModule, WalletModule],
  controllers: [DisbursementController],
  providers: [DisbursementService],
  exports: [DisbursementService],
})
export class DisbursementModule {}
