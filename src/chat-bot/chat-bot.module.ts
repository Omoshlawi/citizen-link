import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ChatBotConfig } from './chat-bot.config';
import { ChatBotController } from './chat-bot.controller';
import { ChatBotService } from './chat-bot.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: ChatBotConfig) => ({
        baseURL: config.baseUrl,
        timeout: 60_000, // 60 s — LLM calls can be slow
      }),
      inject: [ChatBotConfig],
    }),
  ],
  providers: [ChatBotService],
  controllers: [ChatBotController],
})
export class ChatBotModule {}
