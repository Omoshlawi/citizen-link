import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PromptsService } from 'src/prompts/prompts.service';
import {
  AIInteraction,
  AIInteractionType,
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { AiService } from '../ai/ai.service';
import { AsyncError } from '../extraction/extraction.interface';
import { MatchResultDto, MatchResultSchema } from './matching.dto';
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
    const matchResult = await this.aiService.callAIAndStoreParsed(
      prompt,
      [],
      {
        temperature: 0.1,
        max_completion_tokens: 2048,
        schema: MatchResultSchema,
      },
      AIInteractionType.DOCUMENT_MATCHING,
      'Match',
      userId,
    );

    if (!matchResult.callError || !matchResult.parseError) {
      const error = (matchResult.parseError as unknown as AsyncError) ?? {
        message: matchResult.callError,
      };
      this.logger.error(`Failed to verify match: ${JSON.stringify(error)}`);
      throw new BadRequestException(`Failed to verify match: ${error.message}`);
    }

    const matchData = matchResult.parsedResponse as unknown as MatchResultDto;
    this.logger.log(`Match result: ${JSON.stringify(matchData, null, 2)}`);

    return { matchData, aiInteraction: matchResult };
  }
}
