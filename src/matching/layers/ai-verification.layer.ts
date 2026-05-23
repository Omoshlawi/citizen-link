import { Inject, Injectable, Logger } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { PromptsService } from '../../prompts/prompts.service';

import { LostDocumentCase } from 'generated/prisma/client';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
  FoundDocumentCase,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MATCHING_OPTIONS_TOKEN } from '../matching.constants';
import { MatchingOptions } from '../matching.interface';

@Injectable()
export class AiVerificationLayer {
  private readonly logger = new Logger(AiVerificationLayer.name);
  constructor(
    private readonly aiService: AiService,
    private readonly promptsService: PromptsService,
    private readonly prismaService: PrismaService,
    @Inject(MATCHING_OPTIONS_TOKEN)
    private readonly matchingOptions: MatchingOptions,
  ) {}

  private async getDocumentCase(documentId: string): Promise<
    DocumentCase & {
      document: Document & {
        type: DocumentType;
        additionalFields: DocumentField[];
      };
      lostDocumentCase?: LostDocumentCase | null;
      foundDocumentCase?: FoundDocumentCase | null;
    }
  > {
    const document = await this.prismaService.document.findUnique({
      where: { id: documentId },
      include: {
        type: true,
        case: {
          include: {
            lostDocumentCase: true,
            foundDocumentCase: true,
          },
        },
        additionalFields: true, // Added this to match your return type
      },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!document.case) {
      throw new Error(`Document ${documentId} is not associated with a case.`);
    }

    // Destructure to separate 'case' and the rest of the document data
    const { case: documentCase, ...documentData } = document;

    return {
      ...documentCase,
      document: documentData,
    };
  }
}
