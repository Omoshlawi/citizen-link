import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchFoundDocumentService } from './matching.found.service';
import { MatchLostDocumentService } from './matching.lost.service';
import { MatchingVerifierService } from './matching.verifier.service';
import { MatchingController } from './matching.controller';
import { MatchingStatisticsService } from './matching.statistics.service';
import { PromptsModule } from '../prompts/prompts.module';
import { MatchingStatusTransitionService } from './matching.transitions.service';

@Module({
  imports: [PromptsModule],
  providers: [
    MatchingService,
    MatchFoundDocumentService,
    MatchLostDocumentService,
    MatchingVerifierService,
    MatchingStatisticsService,
    MatchingStatusTransitionService,
  ],
  exports: [MatchingService],
  controllers: [MatchingController],
})
export class MatchingModule {}
