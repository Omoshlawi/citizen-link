import { Module } from '@nestjs/common';
import { ClaimService } from './claim.service';
import { ClaimController } from './claim.controller';
import { PromptsModule } from '../prompts/prompts.module';
import { ClaimStatusTransitionService } from './claim.transitions.service';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [PromptsModule, InvoiceModule],
  providers: [ClaimService, ClaimStatusTransitionService],
  exports: [ClaimService],
  controllers: [ClaimController],
})
export class ClaimModule {}
