import { Module } from '@nestjs/common';
import { ClaimService } from './claim.service';
import { ClaimController } from './claim.controller';
import { PromptsModule } from '../prompts/prompts.module';
import { ClaimStatusTransitionService } from './claim.transitions.service';

@Module({
  imports: [PromptsModule],
  providers: [ClaimService, ClaimStatusTransitionService],
  exports: [ClaimService],
  controllers: [ClaimController],
})
export class ClaimModule {}
