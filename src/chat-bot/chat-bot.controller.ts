import { Body, Controller, Post } from '@nestjs/common';
import { ChatDto, ChatResponseDto } from './chat-bot.dto';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { ChatBotService } from './chat-bot.service';

@Controller('chat-bot')
export class ChatBotController {
  constructor(private readonly chatBotService: ChatBotService) {}
  @Post('message')
  @ApiOperation({ summary: 'Send a message to the chat bot' })
  @ApiOkResponse({ type: ChatResponseDto })
  @ApiErrorsResponse({ badRequest: true })
  chat(@Body() chatDto: ChatDto) {
    // Example implementation - in a real app, this would call the ChatBotService
    return this.chatBotService.getChatResponse(chatDto);
  }
}
