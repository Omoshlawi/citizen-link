import { Module } from '@nestjs/common';
import { VisionService } from './vision.service';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';
import { PromptsModule } from '../prompts/prompts.module';
import { VisionController } from './vision.controller';

@Module({
  imports: [
    PromptsModule,
    AiModule.registerAsync({
      useFactory: (config: AiConfig) => {
        return {
          apiKey: config.visionAiApiKey,
          baseURL: config.visionAiBaseUrl,
          model: config.visionAiModel,
          // apiKey: config.textExtractionAiApiKey,
          // baseURL: config.textExtractionAiBaseUrl,
          // model: config.textExtractionAiModel,
        };
      },
      inject: [AiConfig],
    }),
  ],
  providers: [VisionService],
  exports: [VisionService],
  controllers: [VisionController],
})
export class VisionModule {}
