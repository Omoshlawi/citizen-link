import { Body, Controller, Post } from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import { ChatBotService } from './chat-bot.service';
import { ChatDto, ChatResponseDto } from './chat-bot.dto';

@Controller('chat-bot')
export class ChatBotController {
  constructor(private readonly chatBotService: ChatBotService) {}

  @Post('message')
  @ApiOperation({ summary: 'Send a message to the AI assistant' })
  @ApiOkResponse({ type: ChatResponseDto })
  @ApiErrorsResponse({ badRequest: true, unauthorized: true })
  chat(
    @Body() chatDto: ChatDto,
    @Session() { user }: UserSession,
  ): Promise<ChatResponseDto> {
    return this.chatBotService.getChatResponse(chatDto, user.id);
  }
}
