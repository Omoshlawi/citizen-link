import { Module } from '@nestjs/common';
import { PromptsModule } from 'src/prompts/prompts.module';
import { AiConfig } from '../ai/ai.config';
import { AiModule } from '../ai/ai.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';

@Module({
  imports: [
    PromptsModule,
    AiModule.registerAsync({
      useFactory: (config: AiConfig) => {
        return {
          apiKey: config.openaiApiKey,
          baseURL: config.aiBaseUrl,
          model: config.aiModel,
          // apiKey: config.textExtractionAiApiKey,
          // baseURL: config.textExtractionAiBaseUrl,
          // model: config.textExtractionAiModel,
        };
      },
      inject: [AiConfig],
    }),
  ],
  providers: [ExtractionService],
  exports: [ExtractionService],
  controllers: [ExtractionController],
})
export class ExtractionModule {}
