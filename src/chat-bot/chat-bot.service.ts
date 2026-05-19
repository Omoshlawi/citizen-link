import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import { ChatBotConfig } from './chat-bot.config';
import { ChatDto, ChatResponseDto } from './chat-bot.dto';

@Injectable()
export class ChatBotService {
  private readonly logger = new Logger(ChatBotService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ChatBotConfig,
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
}
