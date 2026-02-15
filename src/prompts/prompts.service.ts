import { Injectable } from '@nestjs/common';
import { TemplatesService } from '../common/templates/templates.service';
import {
  DocumentCase,
  DocumentType,
  Document,
  DocumentField,
} from '../../generated/prisma/client';
import {
  DataExtractionSchema,
  SecurityQuestionsDto,
} from '../extraction/extraction.dto';
import z from 'zod';

@Injectable()
export class PromptsService {
  constructor(private templatesService: TemplatesService) {}

  getDocumentDataExtractionPrompt(
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
  ) {
    return this.templatesService.render('prompts', 'document-data-extraction', {
      documentTypes,
    });
  }
  getSecurityQuestionsPrompt(
    documentType: DocumentType,
    extractedData: z.infer<typeof DataExtractionSchema>,
  ) {
    return this.templatesService.render('prompts', 'secutity-questions', {
      documentType,
      extractedData,
    });
  }

  getImageAnalysisPrompt(
    supportedDocumentTypes: Array<
      Pick<DocumentType, 'id' | 'name' | 'category'>
    >,
  ) {
    return this.templatesService.render('prompts', 'image-quality-analysis', {
      supportedDocumentTypes,
    });
  }

  getConfidenceScorePrompt(
    extractedData: z.infer<typeof DataExtractionSchema>,
  ) {
    return this.templatesService.render('prompts', 'field-confidence-scoring', {
      extractedData,
    });
  }

  getMatchVerificationPrompt(
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
  ) {
    const foundTags = (foundCase.tags as Array<string>).length
      ? (foundCase.tags as Array<string>).join(', ')
      : null;
    const lostTags = (lostCase.tags as Array<string>).length
      ? (lostCase.tags as Array<string>).join(', ')
      : null;
    return this.templatesService.render('prompts', 'document-matching', {
      found: foundCase,
      lost: lostCase,
      foundTags,
      lostTags,
    });
  }

  getChatPromptMessage(
    userQuery: string,
    supportedDocumentTypes: Array<string>,
  ) {
    return this.templatesService.render('prompts', 'chatbot-guide', {
      userQuery,
      supportedDocumentTypes,
    });
  }

  getClaimVerificationPrompt(
    securityQuestions: SecurityQuestionsDto['questions'],
    userResponse: Array<{ question: string; response: string }>,
  ) {
    return this.templatesService.render('prompts', 'claim-verification', {
      userResponse,
      securityQuestions,
    });
  }
}
