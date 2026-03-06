import { Inject, Injectable, Logger } from '@nestjs/common';
import { PromptsService } from '../prompts/prompts.service';
import {
  AIInteractionType,
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { AiService } from 'src/ai/ai.service';
import { SecurityQuestionsSchema } from './matching.dto';
import { UserSession } from '../auth/auth.types';
import { MATCHING_OPTIONS_TOKEN } from './matching.constants';
import { MatchingOptions } from './matching.interface';

@Injectable()
export class MatchingSecurityQuestionsService {
  private readonly logger = new Logger(MatchingSecurityQuestionsService.name);
  private readonly MAX_TOKEN = 4096;
  private readonly TEMPERATURE = 0.2;
  private readonly TOP_T = 0.2;
  constructor(
    private readonly promptsService: PromptsService,
    private readonly aiService: AiService,
    @Inject(MATCHING_OPTIONS_TOKEN)
    private readonly matchOptions: MatchingOptions,
  ) {}

  async generateSecurityQuestions(
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
    user: UserSession['user'],
  ) {
    const prompt = await this.promptsService.getSecurityQuestionsPrompt(
      foundCase,
      lostCase,
      this.matchOptions.maxSecurityQuestions,
    );

    const interaction = await this.aiService.callAIAndStoreParsed(
      prompt,
      undefined,
      {
        max_completion_tokens: this.MAX_TOKEN,
        temperature: this.TEMPERATURE,
        top_p: this.TOP_T,
        schema: SecurityQuestionsSchema,
      },
      AIInteractionType.SECURITY_QUESTIONS_GEN,
      'Match',
      user.id,
    );

    if (interaction.parseError || interaction.callError) {
      this.logger.error('Failed to generate security questions', {
        parseError: interaction.parseError,
        callError: interaction.callError,
      });
      return {
        securityQuestions: [],
        interactionId: interaction.id,
      };
    }

    this.logger.log(
      `Generated security question ${interaction.parsedResponse?.length} for cases ${foundCase.caseNumber} and ${lostCase.caseNumber}`,
    );
    return {
      securityQuestions: interaction.parsedResponse!,
      interactionId: interaction.id,
    };
  }
}
