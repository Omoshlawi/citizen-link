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

  // TODO: Refine extraction to start with video validation if the document falls into the supported PII categories,
  // then analize images for data extraction, if analysis threshold is not met, else return error indicating document
  // validation failed.If met continue to data extraction, then security questions generation then confidence scoring.
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

    // Parse and validate image analysis
    const cleanedImageResponse = this.aiService.cleanResponseText(
      imageResult.response,
    );
    const imageParsedResult = safeParseJson<Record<string, any>>(
      cleanedImageResponse,
      { transformNullToUndefined: true },
    );
    if (!imageParsedResult.success) {
      input?.options?.onPublishProgressEvent?.({
        key: 'IMAGE_ANALYSIS',
        state: {
          isLoading: false,
          error: new Error(
            `Image analysis parsing failed: ${imageParsedResult.error.message}`,
          ),
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
                  errorMessage: imageParsedResult.error.message,
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Image analysis parsing failed:',
        imageParsedResult.error,
      );
      throw new BadRequestException(
        `Image analysis parsing failed: ${imageParsedResult.error.message}`,
      );
    }
    const imageValidation = await ImageAnalysisSchema.safeParseAsync(
      imageParsedResult.data,
    );

    if (!imageValidation.success) {
      input?.options?.onPublishProgressEvent?.({
        key: 'IMAGE_ANALYSIS',
        state: {
          isLoading: false,
          error: new Error(
            `Image analysis validation failed: ${JSON.stringify(imageValidation.error.issues)}`,
          ),
        },
      });
      await this.prismaService.aIExtraction.update({
        where: { id: input.extractionId },
        data: {
          aiextractionInteractions: {
            createMany: {
              // Because it parsed the data extraction and confidence successfully, we can add the data to the extraction
              data: [
                {
                  aiInteractionId: imageResult.id,
                  extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
                  errorMessage: JSON.stringify(
                    z.formatError(imageValidation.error),
                  ),
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Image analysis validation failed:',
        imageValidation.error,
      );
      throw new BadRequestException(
        `Image analysis validation failed: ${JSON.stringify(imageValidation.error.issues)}`,
      );
    }

    const imageAnalysis = imageValidation.data;
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

    if (!dataResult.success) {
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
                  errorMessage: dataResult.errorMessage,
                  success: false,
                },
              ],
            },
          },
        },
      });
      input?.options?.onPublishProgressEvent?.({
        key: 'DATA_EXTRACTION',
        state: {
          isLoading: false,
          error: new Error(
            `Data extraction failed: ${dataResult.errorMessage}`,
          ),
        },
      });

      // await input?.options?.onAfterInteractionHook?.(
      //   AIInteractionType.DATA_EXTRACTION,
      //   ()=>
      // );
      throw new BadRequestException(
        `Data extraction failed: ${dataResult.errorMessage}`,
      );
    }

    // Parse and validate data extraction
    const cleanedDataResponse = this.aiService.cleanResponseText(
      dataResult.response,
    );
    const dataParsedResult = safeParseJson<Record<string, any>>(
      cleanedDataResponse,
      { transformNullToUndefined: true },
    );

    if (!dataParsedResult.success) {
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
                  errorMessage: dataParsedResult.error.message,
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Data extraction validation failed:',
        dataParsedResult.error,
      );
      input?.options?.onPublishProgressEvent?.({
        key: 'DATA_EXTRACTION',
        state: {
          isLoading: false,
          error: new Error(
            `Data extraction failed: ${dataResult.errorMessage}`,
          ),
        },
      });
      throw new BadRequestException(
        `Data extraction failed: ${dataParsedResult.error.message}`,
      );
    }

    const dataValidation = await DataExtractionSchema.safeParseAsync(
      dataParsedResult.data,
    );

    if (!dataValidation.success) {
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
                  errorMessage: JSON.stringify(
                    z.formatError(dataValidation.error),
                  ),
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Data extraction validation failed:',
        dataValidation.error,
      );
      input?.options?.onPublishProgressEvent?.({
        key: 'DATA_EXTRACTION',
        state: {
          isLoading: false,
          error: new Error(
            `Data extraction validation failed: ${JSON.stringify(dataValidation.error.issues)}`,
          ),
        },
      });
      throw new BadRequestException(
        `Data extraction validation failed: ${JSON.stringify(dataValidation.error.issues)}`,
      );
    }

    // TODO: REMOVE WHEN YOU VALIDAT AT THE ANALYSIS STEP

    // Validate document type id exists
    const docType = await this.prismaService.documentType.findUnique({
      where: { id: dataValidation.data.typeId },
    });
    if (!docType) {
      await this.prismaService.aIExtraction.update({
        where: { id: input.extractionId },
        data: {
          aiextractionInteractions: {
            create: {
              aiInteractionId: dataResult.id,
              extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
              errorMessage: `Document type with id ${dataValidation.data.typeId} not found`,
              success: false,
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
            `Data extraction validation failed: Document type with id ${dataValidation.data.typeId} not found`,
          ),
        },
      });
      throw new BadRequestException(
        `Data extraction validation failed: Document type with id ${dataValidation.data.typeId} not found`,
      );
    }

    const extractedData = dataValidation.data;
    this.logger.log('Step 2 completed: Data extracted successfully');
    input?.options?.onPublishProgressEvent?.({
      key: 'DATA_EXTRACTION',
      state: {
        isLoading: false,
        data: dataResult,
      },
    });

    // ============= STEP 3: GENERATE SECURITY QUESTIONS =============
    this.logger.log('Step 3: Generating security questions...');
    input?.options?.onPublishProgressEvent?.({
      key: 'SECURITY_QUESTIONS',
      state: { isLoading: true },
    });
    const securityQuestionsPrompt =
      await this.getSecurityQuestionsPromt(extractedData);
    const securityQuestionsResult = await this.aiService.callAIAndStore(
      securityQuestionsPrompt,
      [],
      AIInteractionType.SECURITY_QUESTIONS_GEN,
      'Document',
      input.userId,
    );

    // Parse and validate security questions
    const cleanedSecurityQuestionsResponse = this.aiService.cleanResponseText(
      securityQuestionsResult.response,
    );
    const securityQuestionsParsedResult = safeParseJson<Record<string, any>>(
      cleanedSecurityQuestionsResponse,
      { transformNullToUndefined: true },
    );
    if (!securityQuestionsParsedResult.success) {
      input?.options?.onPublishProgressEvent?.({
        key: 'SECURITY_QUESTIONS',
        state: {
          isLoading: false,
          error: new Error(
            `Security questions parsing failed: ${securityQuestionsParsedResult.error.message}`,
          ),
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
                {
                  aiInteractionId: securityQuestionsResult.id,
                  extractionType:
                    AIExtractionInteractionType.SECURITY_QUESTIONS,
                  errorMessage: securityQuestionsParsedResult.error.message,
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Security questions parsing failed:',
        securityQuestionsParsedResult.error,
      );
      throw new BadRequestException(
        `Security questions parsing failed: ${securityQuestionsParsedResult.error.message}`,
      );
    }
    const securityQuestionsValidation =
      await SecurityQuestionsSchema.safeParseAsync(
        securityQuestionsParsedResult.data,
      );
    if (!securityQuestionsValidation.success) {
      input?.options?.onPublishProgressEvent?.({
        key: 'SECURITY_QUESTIONS',
        state: {
          isLoading: false,
          error: new Error(
            `Security questions validation failed: ${JSON.stringify(securityQuestionsValidation.error.issues)}`,
          ),
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
                {
                  aiInteractionId: securityQuestionsResult.id,
                  extractionType:
                    AIExtractionInteractionType.SECURITY_QUESTIONS,
                  errorMessage: JSON.stringify(
                    z.formatError(securityQuestionsValidation.error),
                  ),
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Security questions validation failed:',
        securityQuestionsValidation.error,
      );
      throw new BadRequestException(
        `Security questions validation failed: ${JSON.stringify(securityQuestionsValidation.error.issues)}`,
      );
    }
    const securityQuestions = securityQuestionsValidation.data;
    this.logger.log('Step 3 completed: Security questions generated');
    input?.options?.onPublishProgressEvent?.({
      key: 'SECURITY_QUESTIONS',
      state: {
        isLoading: false,
        data: securityQuestionsResult,
      },
    });

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
    // Parse and validate confidence
    const cleanedConfidenceResponse = this.aiService.cleanResponseText(
      confidenceResult.response,
    );
    const confidenceParsedResult = safeParseJson<Record<string, any>>(
      cleanedConfidenceResponse,
      { transformNullToUndefined: true },
    );

    if (!confidenceParsedResult.success) {
      input?.options?.onPublishProgressEvent?.({
        key: 'CONFIDENCE_SCORE',
        state: {
          isLoading: false,
          error: new Error(
            `Confidence parsing failed: ${confidenceParsedResult.error.message}`,
          ),
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
                {
                  aiInteractionId: securityQuestionsResult.id,
                  extractionType:
                    AIExtractionInteractionType.SECURITY_QUESTIONS,
                  extractionData: securityQuestions,
                },
                {
                  aiInteractionId: confidenceResult.id,
                  extractionType: AIExtractionInteractionType.CONFIDENCE_SCORE,
                  errorMessage: confidenceParsedResult.error.message,
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Confidence parsing failed:',
        confidenceParsedResult.error,
      );
      throw new BadRequestException(
        `Confidence parsing failed: ${confidenceParsedResult.error.message}`,
      );
    }
    const confidenceValidation = await ConfidenceSchema.safeParseAsync(
      confidenceParsedResult.data,
    );

    if (!confidenceValidation.success) {
      input?.options?.onPublishProgressEvent?.({
        key: 'CONFIDENCE_SCORE',
        state: {
          isLoading: false,
          error: new Error(
            `Confidence validation failed: ${JSON.stringify(confidenceValidation.error.issues)}`,
          ),
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
                {
                  aiInteractionId: securityQuestionsResult.id,
                  extractionType:
                    AIExtractionInteractionType.SECURITY_QUESTIONS,
                  extractionData: securityQuestions,
                },
                {
                  aiInteractionId: confidenceResult.id,
                  extractionType: AIExtractionInteractionType.CONFIDENCE_SCORE,
                  errorMessage: JSON.stringify(
                    z.formatError(confidenceValidation.error),
                  ),
                  success: false,
                },
              ],
            },
          },
        },
      });
      this.logger.error(
        'Confidence validation failed:',
        confidenceValidation.error,
      );
      throw new BadRequestException(
        `Confidence validation failed: ${JSON.stringify(confidenceValidation.error.issues)}`,
      );
    }

    const confidence = confidenceValidation.data;
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
              {
                aiInteractionId: securityQuestionsResult.id,
                extractionData: securityQuestions,
                extractionType: AIExtractionInteractionType.SECURITY_QUESTIONS,
              },
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
}
