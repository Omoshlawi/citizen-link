import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import {
  CustomRepresentationService,
  PaginationService,
  SortService,
} from '../common/query-builder';
import { PrismaService } from '../prisma/prisma.service';
import { ChatBotConfig } from './chat-bot.config';
import {
  ChatDto,
  ChatResponseDto,
  ChatSessionDetailDto,
  GetSessionQueryDto,
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
    private readonly representationService: CustomRepresentationService,
    private readonly sortService: SortService,
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
    const defaultRep =
      'custom:select(id,title,createdAt,updatedAt,_count:select(messages))';

    const totalCount = await this.prismaService.chatSession.count({
      where: { userId, voided: false },
    });

    const results = await this.prismaService.chatSession.findMany({
      where: { userId, voided: false },
      ...this.paginationService.buildSafePaginationQuery(query, totalCount),
      ...this.representationService.buildCustomRepresentationQuery(
        query?.v ?? defaultRep,
      ),
      ...this.sortService.buildSortQuery(query?.orderBy),
    });

    return {
      results,
      ...this.paginationService.buildPaginationControls(
        totalCount,
        originalUrl,
        query,
      ),
    };
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const result = await this.prismaService.chatSession.updateMany({
      where: { id: sessionId, userId, voided: false },
      data: { voided: true },
    });
    if (result.count === 0)
      throw new NotFoundException('Chat session not found');
  }

  async getSession(
    sessionId: string,
    userId: string,
    query: GetSessionQueryDto,
  ): Promise<ChatSessionDetailDto> {
    const defaultRep =
      'custom:select(id,title,createdAt,updatedAt,messages:select(id,sessionId,role,content,createdAt))';
    const session = await this.prismaService.chatSession.findFirst({
      where: { id: sessionId, userId, voided: false },
      ...this.representationService.buildCustomRepresentationQuery(
        query?.v ?? defaultRep,
      ),
    });

    if (!session) throw new NotFoundException('Chat session not found');

    return session as unknown as ChatSessionDetailDto;
  }
}
