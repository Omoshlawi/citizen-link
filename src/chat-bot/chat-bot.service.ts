import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import { PaginationService } from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { ChatBotConfig } from './chat-bot.config';
import {
  ChatDto,
  ChatResponseDto,
  ChatSessionDetailDto,
  ChatSessionSummaryDto,
  ListSessionsQueryDto,
} from './chat-bot.dto';

@Injectable()
export class ChatBotService {
  private readonly logger = new Logger(ChatBotService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ChatBotConfig,
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
  ) {}

  async getChatResponse(
    chatDto: ChatDto,
    userId: string,
  ): Promise<ChatResponseDto> {
    try {
      const response = await lastValueFrom(
        this.httpService.post<{ response: string; session_id: string }>(
          `/v1/chat/message`,
          {
            message: chatDto.query,
            session_id: chatDto.sessionId ?? null,
          },
          {
            headers: {
              'X-User-Id': userId,
              'X-Internal-Secret': this.config.internalSecrete,
            },
          },
        ),
      );

      return {
        response: response.data.response,
        sessionId: response.data.session_id,
      };
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      const detail = axiosErr.response?.data?.error?.message;
      this.logger.error('AI service request failed', {
        status: axiosErr.response?.status,
        detail,
        message: (err as Error).message,
      });
      throw new InternalServerErrorException(
        detail ?? 'AI service unavailable. Please try again.',
      );
    }
  }

  async listSessions(
    userId: string,
    query: ListSessionsQueryDto,
    originalUrl: string,
  ) {
    const totalCount = await this.prismaService.chatSession.count({
      where: { userId, voided: false },
    });

    const sessions = await this.prismaService.chatSession.findMany({
      where: { userId, voided: false },
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    const results: ChatSessionSummaryDto[] = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      messageCount: s._count.messages,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return {
      results,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<ChatSessionDetailDto> {
    const session = await this.prismaService.chatSession.findFirst({
      where: { id: sessionId, userId, voided: false },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            sessionId: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Chat session not found');

    return session as ChatSessionDetailDto;
  }
}
