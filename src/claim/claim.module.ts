import { Module } from '@nestjs/common';
import { ClaimService } from './claim.service';
import { ClaimController } from './claim.controller';
import { PromptsModule } from '../prompts/prompts.module';

@Module({
  imports: [PromptsModule],
  providers: [ClaimService],
  exports: [ClaimService],
  controllers: [ClaimController],
})
export class ClaimModule {}
