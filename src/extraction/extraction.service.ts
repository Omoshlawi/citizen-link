import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import z from 'zod';
import {
  ConfidenceSchema,
  DataExtractionSchema,
  ImageAnalysisSchema,
  SecurityQuestionsSchema,
} from './extraction.dto';
import {
  AIExtractionInteractionType,
  AIInteraction,
  AIInteractionType,
  DocumentType,
} from '../../generated/prisma/client';
import { ExtractInformationInput } from './extraction.interface';
import { safeParseJson } from '../app.utils';
import { PromptsService } from 'src/prompts/prompts.service';

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  constructor(
    private readonly aiService: AiService,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    private readonly promptsService: PromptsService,
  ) {}
  /**
   * Returns a prompt to generate probing security questions about a document,
   * based on the already-extracted data.
   *
   * @param extractedData - Structured data extracted from the document
   * @returns string prompt for an AI model
   */
  private async getSecurityQuestionsPromt(
    extractedData: z.infer<typeof DataExtractionSchema>,
  ): Promise<string> {
    const documentType = await this.prismaService.documentType.findUnique({
      where: {
        id: extractedData.typeId,
      },
    });
    if (!documentType) {
      throw new BadRequestException('Document type not found');
    }
    return this.promptsService.getSecurityQuestionsPrompt(
      documentType,
      extractedData,
    );
  }

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

  /**
   * Parse AI response and validate against schema
   */
  private async parseAndValidate<T, E>(
    response: string,
    schema: z.ZodType<T>,
    onError: (error: unknown) => Promise<E>,
  ): Promise<T | E> {
    try {
      // Clean and parse JSON
      const cleanedResponse = this.aiService.cleanResponseText(response);
      const parsedResult = safeParseJson<Record<string, any>>(cleanedResponse, {
        transformNullToUndefined: true,
      });

      if (!parsedResult.success) {
        throw new Error(
          JSON.stringify({
            message: 'JSON parsing failed',
            error: `${parsedResult.error.message}`,
          }),
        );
      }

      // Validate against schema
      const validation = await schema.safeParseAsync(parsedResult.data);

      if (!validation.success) {
        throw new Error(
          JSON.stringify({
            message: 'Schema validation failed',
            error: z.formatError(validation.error),
          }),
        );
      }

      return validation.data;
    } catch (error: unknown) {
      return await onError?.(error);
    }
  }

  async extractInformation(input: ExtractInformationInput) {
    this.logger.log('Starting four-step extraction process...');
    // Get document types once
    const documentTypes = await this.prismaService.documentType.findMany({
      select: { id: true, name: true, category: true },
    });

    // ============= STEP 1: IMAGE ANALYSIS =============
    this.logger.log('Step 1: Analyzing image quality...');
    input?.options?.onPublishProgressEvent?.({
      key: 'IMAGE_ANALYSIS',
      state: { isLoading: true },
    });

    const imagePrompt =
      await this.promptsService.getImageAnalysisPrompt(documentTypes);

    const imageResult = await this.aiService.callAIAndStore(
      imagePrompt,
      input.files,
      AIInteractionType.IMAGE_ANALYSIS,
      'Document',
      input.userId,
    );

    const imageAnalysis = await this.parseAndValidate(
      imageResult.response,
      ImageAnalysisSchema,
      async (error: Error) => {
        this.logger.error('Error parsing image analysis response:', error);
        input?.options?.onPublishProgressEvent?.({
          key: 'IMAGE_ANALYSIS',
          state: {
            isLoading: false,
            error: error,
          },
        });
        await this.prismaService.aIExtraction.update({
          where: { id: input.extractionId },
          data: {
            aiextractionInteractions: {
              create: {
                aiInteractionId: imageResult.id,
                extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
                errorMessage: error.message,
                success: false,
              },
            },
          },
        });
        throw new BadRequestException(JSON.parse(error.message));
      },
    );

    if (!imageAnalysis.isSupportedDocument) {
      await this.prismaService.aIExtraction.update({
        where: { id: input.extractionId },
        data: {
          aiextractionInteractions: {
            createMany: {
              data: [
                {
                  aiInteractionId: imageResult.id,
                  extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
                  errorMessage: 'Invalid Document; Document is not supported',
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error('Document is not supported');
      input?.options?.onPublishProgressEvent?.({
        key: 'IMAGE_ANALYSIS',
        state: {
          isLoading: false,
          error: new Error('Invalid Document; Document is not supported'),
        },
      });

      throw new BadRequestException('Document is not supported');
    }
    this.logger.log('Step 1 completed: Image analysis finished');
    input?.options?.onPublishProgressEvent?.({
      key: 'IMAGE_ANALYSIS',
      state: {
        isLoading: false,
        data: imageResult,
      },
    });

    // ============= STEP 2: EXTRACT DATA =============
    this.logger.log('Step 2: Extracting document data...');
    input?.options?.onPublishProgressEvent?.({
      key: 'DATA_EXTRACTION',
      state: { isLoading: true },
    });
    const dataPrompt =
      await this.promptsService.getDocumentDataExtractionPrompt(documentTypes);

    const dataResult = await this.aiService.callAIAndStore(
      dataPrompt,
      input.files,
      AIInteractionType.DATA_EXTRACTION,
      'Document',
      input.userId,
    );

    const extractedData = await this.parseAndValidate(
      dataResult.response,
      DataExtractionSchema,
      async (error: Error) => {
        this.logger.error('Error parsing data extraction response:', error);
        input?.options?.onPublishProgressEvent?.({
          key: 'DATA_EXTRACTION',
          state: {
            isLoading: false,
            error: error,
          },
        });
        await this.prismaService.aIExtraction.update({
          where: { id: input.extractionId },
          data: {
            aiextractionInteractions: {
              createMany: {
                data: [
                  {
                    extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
                    aiInteractionId: imageResult.id,
                    extractionData: imageAnalysis,
                  },
                  {
                    aiInteractionId: dataResult.id,
                    extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
                    errorMessage: error.message,
                    success: false,
                  },
                ],
              },
            },
          },
        });
        throw new BadRequestException(JSON.parse(error.message));
      },
    );
    // Validate document type id exists
    const docType = await this.prismaService.documentType.findUnique({
      where: { id: extractedData.typeId },
    });
    if (!docType) {
      await this.prismaService.aIExtraction.update({
        where: { id: input.extractionId },
        data: {
          aiextractionInteractions: {
            createMany: {
              data: [
                {
                  extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
                  aiInteractionId: imageResult.id,
                  extractionData: imageAnalysis,
                },
                {
                  aiInteractionId: dataResult.id,
                  extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
                  errorMessage: 'Unsupported Document',
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Data extraction validation failed: Document type not found',
      );
      input?.options?.onPublishProgressEvent?.({
        key: 'DATA_EXTRACTION',
        state: {
          isLoading: false,
          error: new Error(
            `Data extraction validation failed: Document type with id ${extractedData.typeId} not found`,
          ),
        },
      });
      throw new BadRequestException(
        `Data extraction validation failed: Document type with id ${extractedData.typeId} not found`,
      );
    }

    this.logger.log('Step 2 completed: Data extracted successfully');
    input?.options?.onPublishProgressEvent?.({
      key: 'DATA_EXTRACTION',
      state: {
        isLoading: false,
        data: dataResult,
      },
    });

    // ============= STEP 3: GENERATE SECURITY QUESTIONS =============
    let securityQuestions: z.infer<typeof SecurityQuestionsSchema> | null =
      null;
    let securityQuestionsResult: AIInteraction | null = null;
    if (!input.options?.skipSecurityQuestion) {
      this.logger.log('Step 3: Generating security questions...');
      input?.options?.onPublishProgressEvent?.({
        key: 'SECURITY_QUESTIONS',
        state: { isLoading: true },
      });
      const securityQuestionsPrompt =
        await this.getSecurityQuestionsPromt(extractedData);
      securityQuestionsResult = await this.aiService.callAIAndStore(
        securityQuestionsPrompt,
        [],
        AIInteractionType.SECURITY_QUESTIONS_GEN,
        'Document',
        input.userId,
      );

      securityQuestions = await this.parseAndValidate(
        securityQuestionsResult.response,
        SecurityQuestionsSchema,
        async (error: Error) => {
          this.logger.error(
            'Error parsing security questions response:',
            error,
          );
          input?.options?.onPublishProgressEvent?.({
            key: 'SECURITY_QUESTIONS',
            state: {
              isLoading: false,
              error,
            },
          });
          await this.prismaService.aIExtraction.update({
            where: { id: input.extractionId },
            data: {
              aiextractionInteractions: {
                createMany: {
                  data: [
                    {
                      aiInteractionId: imageResult.id,
                      extractionType:
                        AIExtractionInteractionType.IMAGE_ANALYSIS,
                      extractionData: imageAnalysis,
                    },
                    {
                      aiInteractionId: dataResult.id,
                      extractionType:
                        AIExtractionInteractionType.DATA_EXTRACTION,
                      extractionData: extractedData,
                    },
                    {
                      aiInteractionId: securityQuestionsResult!.id,
                      extractionType:
                        AIExtractionInteractionType.SECURITY_QUESTIONS,
                      errorMessage: error.message,
                      success: false,
                    },
                  ],
                },
              },
            },
          });

          throw new BadRequestException(JSON.parse(error.message));
        },
      );
      this.logger.log('Step 3 completed: Security questions generated');
      input?.options?.onPublishProgressEvent?.({
        key: 'SECURITY_QUESTIONS',
        state: {
          isLoading: false,
          data: securityQuestionsResult,
        },
      });
    }

    // ============= STEP 4: CALCULATE CONFIDENCE =============
    this.logger.log('Step 4: Calculating confidence scores...');
    input?.options?.onPublishProgressEvent?.({
      key: 'CONFIDENCE_SCORE',
      state: { isLoading: true },
    });

    const confidencePrompt =
      await this.promptsService.getConfidenceScorePrompt(extractedData);

    const confidenceResult = await this.aiService.callAIAndStore(
      confidencePrompt,
      input.files,
      AIInteractionType.CONFIDENCE_SCORE,
      'Document',
      input.userId,
    );

    const confidence = await this.parseAndValidate(
      confidenceResult.response,
      ConfidenceSchema,
      async (error: Error) => {
        this.logger.error('Error parsing confidence response:', error);
        input?.options?.onPublishProgressEvent?.({
          key: 'CONFIDENCE_SCORE',
          state: {
            isLoading: false,
            error,
          },
        });
        await this.prismaService.aIExtraction.update({
          where: { id: input.extractionId },
          data: {
            aiextractionInteractions: {
              createMany: {
                data: [
                  {
                    aiInteractionId: imageResult.id,
                    extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
                    extractionData: imageAnalysis,
                  },
                  {
                    aiInteractionId: dataResult.id,
                    extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
                    extractionData: extractedData,
                  },
                  ...this.getSecurityQuizAiExtractionInteraction(
                    securityQuestionsResult,
                    securityQuestions,
                  ),
                  {
                    aiInteractionId: confidenceResult.id,
                    extractionType:
                      AIExtractionInteractionType.CONFIDENCE_SCORE,
                    errorMessage: error.message,
                    success: false,
                  },
                ],
              },
            },
          },
        });

        throw new BadRequestException(JSON.parse(error.message));
      },
    );
    this.logger.log('Step 4 completed: Confidence scores calculated');
    input?.options?.onPublishProgressEvent?.({
      key: 'CONFIDENCE_SCORE',
      state: {
        isLoading: false,
        data: confidenceResult,
      },
    });

    // ============= CREATE FINAL EXTRACTION RECORD =============
    this.logger.log('Creating final extraction record...');

    const extraction = await this.prismaService.aIExtraction.update({
      where: { id: input.extractionId },
      data: {
        aiextractionInteractions: {
          createMany: {
            data: [
              {
                aiInteractionId: imageResult.id,
                extractionData: imageAnalysis,
                extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
              },
              {
                aiInteractionId: dataResult.id,
                extractionData: extractedData,
                extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
              },
              ...this.getSecurityQuizAiExtractionInteraction(
                securityQuestionsResult,
                securityQuestions,
              ),
              {
                aiInteractionId: confidenceResult.id,
                extractionData: confidence,
                extractionType: AIExtractionInteractionType.CONFIDENCE_SCORE,
              },
            ],
          },
        },
      },
      include: {
        aiextractionInteractions: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            aiInteraction: true,
          },
        },
      },
    });

    this.logger.log('Extraction completed successfully!');
    return extraction;
  }

  private getSecurityQuizAiExtractionInteraction(
    securityQuestionsResult: AIInteraction | null,
    securityQuestions: z.infer<typeof SecurityQuestionsSchema> | null,
  ) {
    if (!securityQuestionsResult || !securityQuestions) return [];
    return [
      {
        aiInteractionId: securityQuestionsResult.id,
        extractionData: securityQuestions,
        extractionType: AIExtractionInteractionType.SECURITY_QUESTIONS,
      },
    ];
  }
}
