import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { PromptsModule } from '../prompts/prompts.module';
import { MatchingStatusTransitionService } from './matching.transitions.service';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';
import { AiVerificationLayer } from './layers/ai-verification.layer';
import { ExactMatchLayer, VectorSearchLayer } from './layers';
import { MatchingQueryService } from './matching.query';
import { MatchingVectorSearchService } from './matching.vector-search';
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
    MatchingQueryService,
    MatchingService,
    MatchingStatusTransitionService,
    MatchingVectorSearchService,
    VectorSearchLayer, // layer 1
    ExactMatchLayer, // layer 2
    AiVerificationLayer, // layer 3
  ],
  exports: [MatchingService],
  controllers: [MatchingController],
})
export class MatchingModule {}
