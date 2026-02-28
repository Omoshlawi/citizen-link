import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchFoundDocumentService } from './matching.found.service';
import { MatchLostDocumentService } from './matching.lost.service';
import { MatchingVerifierService } from './matching.verifier.service';
import { MatchingController } from './matching.controller';
import { MatchingStatisticsService } from './matching.statistics.service';
import { PromptsModule } from '../prompts/prompts.module';
import { MatchingStatusTransitionService } from './matching.transitions.service';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';

@Module({
  imports: [
    PromptsModule,
    AiModule.registerAsync({
      useFactory: (config: AiConfig) => {
        return {
          apiKey: config.openaiApiKey,
          baseURL: config.aiBaseUrl,
          model: config.aiModel || 'gpt-4o', // Default to GPT-4o, can be overridden via env var
        };
      },
      inject: [AiConfig],
    }),
  ],
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
