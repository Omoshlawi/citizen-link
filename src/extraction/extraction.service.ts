import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromptsService } from '../prompts/prompts.service';
import { VisionService } from '../vision/vision.service';
import { ExtractInformationInput } from './extraction.interface';
import { AIExtractionInteractionType } from '../../generated/prisma/enums';
import { VisionExtractionOutputDto } from '../vision/vision.dto';
import { TextExtractionOutputSchema } from './extraction.dto';
import { safeParseJson } from '../app.utils';
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
    private readonly visionService: VisionService,
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

  async extract(visionOutputDto: VisionExtractionOutputDto) {
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

  async extractInformation(input: ExtractInformationInput) {
    const visionResult = await this.visionService.extractTextFromImage(
      input.files,
      input.user,
    );

    return await this.prismaService.aIExtraction.update({
      where: { id: input.extractionId },
      data: {
        aiextractionInteractions: {
          createMany: {
            data: [
              {
                aiInteractionId: visionResult.id,
                extractionType: AIExtractionInteractionType.TEXT_EXTRACTION,
              },
            ],
          },
        },
      },
      include: { aiextractionInteractions: true },
    });
  }
}
