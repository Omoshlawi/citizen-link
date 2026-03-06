import { Injectable } from '@nestjs/common';
import { TemplatesService } from '../common/templates/templates.service';
import {
  DocumentCase,
  DocumentType,
  Document,
  DocumentField,
} from '../../generated/prisma/client';
import z from 'zod';
import { VisionExtractionOutputSchema } from '../vision/vision.dto';
import { MatchedField } from 'src/matching/matching.interface';

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

  getImageAnalysisPrompt(
    supportedDocumentTypes: Array<
      Pick<DocumentType, 'id' | 'name' | 'category'>
    >,
  ) {
    return this.templatesService.render('prompts', 'image-quality-analysis', {
      supportedDocumentTypes,
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
    matchedFields: MatchedField[],
  ) {
    const foundTags = (foundCase.tags as Array<string>).length
      ? (foundCase.tags as Array<string>).join(', ')
      : null;
    const lostTags = (lostCase.tags as Array<string>).length
      ? (lostCase.tags as Array<string>).join(', ')
      : null;
    return this.templatesService.render('prompts', 'match-verification', {
      found: foundCase,
      lost: lostCase,
      foundTags,
      lostTags,
      matchedFields,
    });
  }

  getSecurityQuestionsPrompt(
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
    maxSecurityQuestions: number,
  ) {
    const foundTags = (foundCase.tags as Array<string>).length
      ? (foundCase.tags as Array<string>).join(', ')
      : null;
    const lostTags = (lostCase.tags as Array<string>).length
      ? (lostCase.tags as Array<string>).join(', ')
      : null;
    return this.templatesService.render('prompts', 'security-questions', {
      found: foundCase,
      lost: lostCase,
      foundTags,
      lostTags,
      maxSecurityQuestions,
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

  getVisionExtractionPrompt(
    output: 'structured' | 'unstructured' = 'structured',
  ) {
    return this.templatesService.render(
      'prompts',
      `vision-extraction-${output}`,
      {},
    );
  }

  getTextExtractionPrompt(
    visionOutput: z.infer<typeof VisionExtractionOutputSchema>,
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
  ) {
    return this.templatesService.render('prompts', 'text-extraction', {
      visionOutput: JSON.stringify(visionOutput, null, 2),
      documentTypes,
    });
  }
}
