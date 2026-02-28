import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIExtractionInteractionType } from '../../generated/prisma/enums';
import { AiService } from '../ai/ai.service';
import { safeParseJson } from '../app.utils';
import { UserSession } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { PromptsService } from '../prompts/prompts.service';
import { VisionExtractionOutputDto } from '../vision/vision.dto';
import { TextExtractionOutputSchema } from './extraction.dto';
@Injectable()
export class ExtractionService {
  private readonly MAX_TOKEN = 4096;
  private readonly TEMPERATURE = 0.2;
  private readonly TOP_T = 0.2;
  private readonly logger = new Logger(ExtractionService.name);
  constructor(
    private readonly aiService: AiService,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    private readonly promptsService: PromptsService,
  ) {}
  async getOrCreateAiExtraction(extractionId?: string) {
    if (extractionId) {
      const extraction = await this.prismaService.aIExtraction.findUnique({
        where: { id: extractionId },
        include: { aiextractionInteractions: true },
      });
      if (!extraction)
        throw new NotFoundException('extraction with id not found');
    }
    return await this.prismaService.aIExtraction.create({
      data: {},
      include: { aiextractionInteractions: true },
    });
  }

  async testExtraction(visionOutputDto: VisionExtractionOutputDto) {
    const documentTypes = await this.prismaService.documentType.findMany({
      where: {},
      select: { id: true, name: true, category: true, code: true },
    });
    const prompt = await this.promptsService.getTextExtractionPrompt(
      visionOutputDto,
      documentTypes,
    );
    const content = await this.aiService.generateContent([{ text: prompt }], {
      temperature: this.TEMPERATURE,
      max_completion_tokens: this.MAX_TOKEN,
      top_p: this.TOP_T,
      systemPrompt: 'You are a helpful assistant.',
    });
    return {
      raw: safeParseJson(
        this.aiService.cleanResponseText(content.text ?? JSON.stringify({})),
      ),
      content: await this.aiService.parseAndValidate(
        content.text ?? '',
        TextExtractionOutputSchema,
        (error) => {
          this.logger.error(error);
          return null;
        },
      ),
      usage: content.usageMetadata,
      model: content.modelVersion,
    };
  }

  async extractDocumentData(
    visionOutputDto: VisionExtractionOutputDto,
    user: UserSession['user'],
  ) {
    const documentTypes = await this.prismaService.documentType.findMany({
      where: {},
      select: { id: true, name: true, category: true, code: true },
    });
    const prompt = await this.promptsService.getTextExtractionPrompt(
      visionOutputDto,
      documentTypes,
    );
    return await this.aiService.callAIAndStoreParsed(
      prompt,
      undefined,
      {
        temperature: this.TEMPERATURE,
        max_completion_tokens: this.MAX_TOKEN,
        top_p: this.TOP_T,
        schema: TextExtractionOutputSchema,
      },
      AIExtractionInteractionType.TEXT_EXTRACTION,
      'Extraction',
      user?.id,
    );
  }
}
