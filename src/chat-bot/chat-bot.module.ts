import { Module } from '@nestjs/common';
import { PromptsModule } from 'src/prompts/prompts.module';
import { ChatBotController } from './chat-bot.controller';
import { ChatBotService } from './chat-bot.service';

@Module({
  imports: [PromptsModule],
  providers: [ChatBotService],
  controllers: [ChatBotController],
})
export class ChatBotModule {}
