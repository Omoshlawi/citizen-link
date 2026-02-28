import { Module } from '@nestjs/common';
import { ExtractionService } from './extraction.service';
import { PromptsModule } from 'src/prompts/prompts.module';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';
import { VisionModule } from '../vision/vision.module';
import { ExtractionController } from './extraction.controller';

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
    VisionModule,
  ],
  providers: [ExtractionService],
  exports: [ExtractionService],
  controllers: [ExtractionController],
})
export class ExtractionModule {}
