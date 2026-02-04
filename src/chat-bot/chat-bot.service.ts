import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ChatDto } from './chat-bot.dto';
import { PromptsService } from '../prompts/prompts.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatBotService {
  constructor(
    private readonly aiService: AiService,
    private readonly promptsService: PromptsService,
    private readonly prismaService: PrismaService,
  ) {}

  async getChatResponse(chatDto: ChatDto) {
    const documentTypes = await this.prismaService.documentType.findMany({
      select: { name: true },
    });
    const prompt = await this.promptsService.getChatPromptMessage(
      chatDto.query,
      documentTypes.map((dt) => dt.name),
    );
    const content = await this.aiService.generateContent([{ text: prompt }], {
      temperature: 0.3,
    });
    return { response: content.text ?? '' };
  }
}
