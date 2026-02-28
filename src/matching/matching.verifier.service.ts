import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AIInteraction,
  AIInteractionType,
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { AiService } from '../ai/ai.service';
import { safeParseJson } from '../app.utils';
import { MatchResultDto, MatchResultSchema } from './matching.dto';
import { PromptsService } from 'src/prompts/prompts.service';
@Injectable()
export class MatchingVerifierService {
  private readonly logger = new Logger(MatchingVerifierService.name);
  constructor(
    private readonly aiService: AiService,
    private readonly promptsService: PromptsService,
  ) {}

  /**
   * Use LLM to verify if two documents match
   */
  async verifyMatch(
    foundCase: DocumentCase & {
      document: Document & {
        type: DocumentType;
        additionalFields: DocumentField[];
      };
    },
    lostCase: DocumentCase & {
      document: Document & {
        type: DocumentType;
        additionalFields: DocumentField[];
      };
    },
    userId: string,
  ): Promise<{ matchData: MatchResultDto; aiInteraction: AIInteraction }> {
    const prompt = await this.promptsService.getMatchVerificationPrompt(
      foundCase,
      lostCase,
    );
    const matchResult = await this.aiService.callAIAndStore(
      prompt,
      [],
      {
        temperature: 0.1,
        max_completion_tokens: 2048,
        // response_format: zodResponseFormat(DataExtractionSchema, 'dataExtractionDto'),
      },
      AIInteractionType.DOCUMENT_MATCHING,
      'Match',
      userId,
    );

    if (!matchResult.success) {
      this.logger.error(`Failed to verify match: ${matchResult.errorMessage}`);
      throw new BadRequestException(
        `Failed to verify match: ${matchResult.errorMessage}`,
      );
    }

    const cleanedResponse = this.aiService.cleanResponseText(
      matchResult.response,
    );

    const matchResultParsed = safeParseJson<{
      confidence: number;
      reasons: string[];
    }>(cleanedResponse, { transformNullToUndefined: true });

    if (!matchResultParsed.success) {
      this.logger.error(
        `Failed to parse match result: ${matchResultParsed.error.message}`,
      );
      throw new BadRequestException(
        `Failed to parse match result: ${matchResultParsed.error.message}`,
      );
    }

    const matchValidation = await MatchResultSchema.safeParseAsync(
      matchResultParsed.data,
    );

    if (!matchValidation.success) {
      this.logger.error(
        `Failed to validate match result: ${matchValidation.error.message}`,
      );
      throw new BadRequestException(
        `Failed to validate match result: ${matchValidation.error.message}`,
      );
    }

    const matchData = matchValidation.data;
    this.logger.log(`Match result: ${JSON.stringify(matchData, null, 2)}`);

    return { matchData, aiInteraction: matchResult };
  }
}
