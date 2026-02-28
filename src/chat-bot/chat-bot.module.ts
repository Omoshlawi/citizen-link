import { Module } from '@nestjs/common';
import { PromptsModule } from 'src/prompts/prompts.module';
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
          apiKey: config.openaiApiKey,
          baseURL: config.aiBaseUrl,
          model: config.aiModel || 'gpt-4o', // Default to GPT-4o, can be overridden via env var
        };
      },
      inject: [AiConfig],
    }),
  ],
  providers: [ChatBotService],
  controllers: [ChatBotController],
})
export class ChatBotModule {}
