import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Session } from '@thallesp/nestjs-better-auth';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorsResponse } from '../app.decorators';
import { UserSession } from '../auth/auth.types';
import { OriginalUrl } from '../common/query-builder';
import { ChatBotService } from './chat-bot.service';
import {
  ChatDto,
  ChatResponseDto,
  ChatSessionDetailDto,
  ListSessionsQueryDto,
  ListSessionsResponseDto,
} from './chat-bot.dto';

@ApiTags('chat-bot')
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

  @Get('sessions')
  @ApiOperation({ summary: 'List chat sessions for the authenticated user' })
  @ApiOkResponse({ type: ListSessionsResponseDto })
  @ApiErrorsResponse({ unauthorized: true })
  listSessions(
    @Query() query: ListSessionsQueryDto,
    @Session() { user }: UserSession,
    @OriginalUrl() originalUrl: string,
  ): Promise<ListSessionsResponseDto> {
    return this.chatBotService.listSessions(user.id, query, originalUrl);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a chat session with all messages' })
  @ApiOkResponse({ type: ChatSessionDetailDto })
  @ApiErrorsResponse({ unauthorized: true })
  getSession(
    @Param('id') id: string,
    @Session() { user }: UserSession,
  ): Promise<ChatSessionDetailDto> {
    return this.chatBotService.getSession(id, user.id);
  }
}
