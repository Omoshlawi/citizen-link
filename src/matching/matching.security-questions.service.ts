/* eslint-disable @typescript-eslint/no-unused-vars */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { AiService } from '../ai/ai.service';
import { UserSession } from '../auth/auth.types';
import { PromptsService } from '../prompts/prompts.service';
import { MATCHING_OPTIONS_TOKEN } from './matching.constants';
import { MatchingOptions } from './matching.interface';

@Injectable()
export class MatchingSecurityQuestionsService {
  private readonly logger = new Logger(MatchingSecurityQuestionsService.name);
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
  }
}
