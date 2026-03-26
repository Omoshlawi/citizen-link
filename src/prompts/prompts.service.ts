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
import { MatchedField } from '../matching/matching.interface';

@Injectable()
export class PromptsService {
  constructor(private templatesService: TemplatesService) {}

  async getDocumentDataExtractionPrompt(
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
  ) {
    const { rendered } = await this.templatesService.renderSlot(
      'prompt.document.data.extraction',
      'user',
      {
        documentTypes,
      },
    );
    return rendered;
  }

  async getImageAnalysisPrompt(
    supportedDocumentTypes: Array<
      Pick<DocumentType, 'id' | 'name' | 'category'>
    >,
  ) {
    const { rendered } = await this.templatesService.renderSlot(
      'prompt.image.quality.analysis',
      'user',
      {
        supportedDocumentTypes,
      },
    );
    return rendered;
  }

  async getMatchVerificationPrompt(
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
    const { rendered } = await this.templatesService.renderSlot(
      'prompt.match.verification',
      'user',
      {
        found: foundCase,
        lost: lostCase,
        foundTags,
        lostTags,
        matchedFields,
      },
    );
    return rendered;
  }

  async getSecurityQuestionsPrompt(
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
    const { rendered } = await this.templatesService.renderSlot(
      'prompt.security.questions',
      'user',
      {
        found: foundCase,
        lost: lostCase,
        foundTags,
        lostTags,
        maxSecurityQuestions,
      },
    );
    return rendered;
  }

  async getChatPromptMessage(
    userQuery: string,
    supportedDocumentTypes: Array<string>,
  ) {
    const { rendered } = await this.templatesService.renderSlot(
      'prompt.chatbot.guide',
      'user',
      {
        userQuery,
        supportedDocumentTypes,
      },
    );
    return rendered;
  }

  async getVisionExtractionPrompt(
    output: 'structured' | 'unstructured' = 'structured',
  ) {
    const { rendered } = await this.templatesService.renderSlot(
      `prompt.vision.extraction.${output}`,
      'user',
      {},
    );
    return rendered;
  }

  async getTextExtractionPrompt(
    visionOutput: z.infer<typeof VisionExtractionOutputSchema>,
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
  ) {
    const { rendered } = await this.templatesService.renderSlot(
      'prompt.text.extraction',
      'user',
      {
        visionOutput: JSON.stringify(visionOutput, null, 2),
        documentTypes,
      },
    );
    return rendered;
  }
}
