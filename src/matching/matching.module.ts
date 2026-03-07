import { DynamicModule, Module, Provider } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { PromptsModule } from '../prompts/prompts.module';
import { MatchingStatusTransitionService } from './matching.transitions.service';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';
import { AiVerificationLayer } from './layers/ai-verification.layer';
import { ExactMatchLayer, VectorSearchLayer } from './layers';
import { MatchingQueryService } from './matching.query.service';
import { MatchingVectorSearchService } from './matching.vector-search';
import { MatchingLayeredService } from './matching.layered.service';
import { MatchingSecurityQuestionsService } from './matching.security-questions.service';
import { MatchingModuleAsyncOptions } from './matching.interface';
import { MATCHING_OPTIONS_TOKEN } from './matching.constants';
@Module({})
export class MatchingModule {
  static registerAsync(
    options: MatchingModuleAsyncOptions = {},
  ): DynamicModule {
    return {
      global: options.global,
      module: MatchingModule,
      imports: [
        ...(options.imports ?? []),
        PromptsModule,
        AiModule.registerAsync({
          useFactory: (config: AiConfig) => {
            return {
              apiKey: config.openaiApiKey,
              baseURL: config.aiBaseUrl,
              model: config.aiModel, // Default to GPT-4o, can be overridden via env var
            };
          },
          inject: [AiConfig],
        }),
      ],
      providers: [
        ...(options.providers || []),
        this.createAsyncProvider(options),
        MatchingQueryService,
        MatchingService,
        MatchingStatusTransitionService,
        MatchingVectorSearchService,
        VectorSearchLayer, // layer 1
        ExactMatchLayer, // layer 2
        MatchingSecurityQuestionsService, // For layer 3 post verification
        AiVerificationLayer, // layer 3
        MatchingLayeredService,
      ],
      exports: [MatchingService, MatchingLayeredService],
      controllers: [MatchingController],
    };
  }

  private static createAsyncProvider(
    options: MatchingModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: MATCHING_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject,
      };
    }
    if (options.useClass) {
      return {
        provide: MATCHING_OPTIONS_TOKEN,
        useClass: options.useClass,
      };
    }
    if (options.useExisting) {
      return {
        provide: MATCHING_OPTIONS_TOKEN,
        useExisting: options.useExisting,
      };
    }
    if (options.useValue) {
      return {
        provide: MATCHING_OPTIONS_TOKEN,
        useValue: options.useValue,
      };
    }
    throw new Error('Invalid options');
  }
}
