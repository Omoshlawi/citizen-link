import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  GetSessionQueryDto,
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
  ) {
    return this.chatBotService.listSessions(user.id, query, originalUrl);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a chat session with all messages' })
  @ApiOkResponse({ type: ChatSessionDetailDto })
  @ApiErrorsResponse({ unauthorized: true })
  getSession(
    @Param('id') id: string,
    @Query() query: GetSessionQueryDto,
    @Session() { user }: UserSession,
  ): Promise<ChatSessionDetailDto> {
    return this.chatBotService.getSession(id, user.id, query);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a chat session' })
  @ApiErrorsResponse({ unauthorized: true })
  deleteSession(
    @Param('id') id: string,
    @Session() { user }: UserSession,
  ): Promise<void> {
    return this.chatBotService.deleteSession(id, user.id);
  }
}
