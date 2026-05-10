import { Module } from '@nestjs/common';
import { ClaimService } from './claim.service';
import { ClaimController } from './claim.controller';
import { PromptsModule } from '../prompts/prompts.module';
import { ClaimStatusTransitionService } from './claim.transitions.service';
import { InvoiceModule } from '../invoice/invoice.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PromptsModule, InvoiceModule, NotificationsModule],
  providers: [ClaimService, ClaimStatusTransitionService],
  exports: [ClaimService],
  controllers: [ClaimController],
})
export class ClaimModule {}
