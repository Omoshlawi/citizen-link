import { Module } from '@nestjs/common';
import { VisionService } from './vision.service';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';
import { PromptsModule } from 'src/prompts/prompts.module';
import { VisionController } from './vision.controller';

@Module({
  imports: [
    PromptsModule,
    AiModule.registerAsync({
      useFactory: (config: AiConfig) => {
        return {
          apiKey: config.visionAiApiKey,
          // apiKey: config.textExtractionAiApiKey,
          baseURL: config.visionAiBaseUrl,
          // baseURL: config.textExtractionAiBaseUrl,
          model: config.visionAiModel,
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
