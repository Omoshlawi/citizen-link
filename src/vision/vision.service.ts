import { Injectable, Logger } from '@nestjs/common';
import { AIInteractionType } from '../../generated/prisma/enums';
import { AiService } from '../ai/ai.service';
import { UserSession } from '../auth/auth.types';
import { PromptsService } from '../prompts/prompts.service';
import { VisionExtractionOutputSchema } from './vision.dto';
import { safeParseJson } from 'src/app.utils';

@Injectable()
export class VisionService {
  private readonly MAX_TOKEN = 4096;
  private readonly TEMPERATURE = 0.2;
  private readonly TOP_T = 0.2;
  private readonly logger = new Logger(VisionService.name);
  constructor(
    private readonly aiService: AiService,
    private readonly promptService: PromptsService,
  ) {}

  async extractTextFromImage(
    images: Array<{ buffer: Buffer; mimeType: string }> | undefined,
    user?: UserSession['user'],
  ) {
    const prompt = await this.promptService.getVisionExtractionPrompt();
    return await this.aiService.callAIAndStoreParsed(
      prompt,
      images,
      {
        temperature: this.TEMPERATURE,
        max_completion_tokens: this.MAX_TOKEN,
        top_p: this.TOP_T,
        schema: VisionExtractionOutputSchema,
        transformResponse(response) {
          // compute averageConfidence deterministically — more reliable than model output
          const allBlocks = response.pages.flatMap((p) => p.blocks);
          const textBlocks = allBlocks.filter(
            (b) => b.type === 'text' && b.text?.length > 0,
          );
          const avgConf = textBlocks?.length
            ? Math.round(
                textBlocks.reduce((sum, b) => sum + b.confidence, 0) /
                  textBlocks.length,
              )
            : 0;
          // Build fullText from blocks in page order — more reliable than model output
          const fullText = response.pages
            .flatMap((p) =>
              p.blocks.filter((b) => b.type === 'text').map((b) => b.text),
            )
            .join('\n');

          return {
            ...response,
            averageConfidence: avgConf,
            fullText,
            pages: response.pages.map((page) => ({
              ...page,
              blocks: page.blocks.map((block) => ({
                ...block,
                text: block.text.trim(),
              })),
            })),
          };
        },
      },
      AIInteractionType.VISION_EXTRACTION,
      'Extraction',
      user?.id,
    );
  }

  async testExtraction(documents: Express.Multer.File[]) {
    const prompt =
      await this.promptService.getVisionExtractionPrompt('structured');
    const parts = [
      { text: prompt },
      ...(documents
        ? documents.map((document) =>
            this.aiService.fileToGenerativePart(
              document.buffer,
              document.mimetype,
            ),
          )
        : []),
    ];
    const content = await this.aiService.generateContent(parts, {
      temperature: this.TEMPERATURE,
      max_completion_tokens: this.MAX_TOKEN,
      top_p: this.TOP_T,
      systemPrompt:
        'You are a pure OCR engine. You only read. You never interpret.',
    });
    return {
      raw: safeParseJson(
        this.aiService.cleanResponseText(content.text ?? JSON.stringify({})),
      ),
      content: await this.aiService.parseAndValidate(
        content.text ?? '',
        VisionExtractionOutputSchema,
        (error) => {
          this.logger.error(error);
          return null;
        },
        (response) => {
          // compute averageConfidence deterministically — more reliable than model output
          const allBlocks = response.pages.flatMap((p) => p.blocks);
          const textBlocks = allBlocks.filter(
            (b) => b.type === 'text' && b.text?.length > 0,
          );
          const avgConf = textBlocks?.length
            ? Math.round(
                textBlocks.reduce((sum, b) => sum + b.confidence, 0) /
                  textBlocks.length,
              )
            : 0;
          // Build fullText from blocks in page order — more reliable than model output
          const fullText = response.pages
            .flatMap((p) =>
              p.blocks.filter((b) => b.type === 'text').map((b) => b.text),
            )
            .join('\n');

          return {
            ...response,
            averageConfidence: avgConf,
            fullText,
            pages: response.pages.map((page) => ({
              ...page,
              blocks: page.blocks.map((block) => ({
                ...block,
                text: block.text.trim(),
              })),
            })),
          };
        },
      ),
      usage: content.usageMetadata,
      model: content.modelVersion,
    };
  }
}
