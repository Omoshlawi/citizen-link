import { Module } from '@nestjs/common';
import { PromptsModule } from '../prompts/prompts.module';
import { ChatBotController } from './chat-bot.controller';
import { ChatBotService } from './chat-bot.service';
import { AiModule } from '../ai/ai.module';
import { AiConfig } from '../ai/ai.config';

@Module({
  imports: [
    PromptsModule,
    AiModule.registerAsync({
      useFactory: (config: AiConfig) => {
        return {
          apiKey: config.textExtractionAiApiKey,
          baseURL: config.textExtractionAiBaseUrl,
          model: config.textExtractionAiModel,
        };
      },
      inject: [AiConfig],
    }),
  ],
  providers: [ChatBotService],
  controllers: [ChatBotController],
})
export class ChatBotModule {}
