/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { GenerateContentConfig, GenerateContentResponse } from '@google/genai';
import { BadRequestException, Logger } from '@nestjs/common';
import z from 'zod';
import {
  AIExtractionInteractionType,
  AIInteractionType,
  DocumentType,
} from '../../generated/prisma/client';
import { safeParseJson } from '../app.utils';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_CONFIDENCE_CONFIG,
  AI_DATA_EXTRACT_CONFIG,
  AI_IMAGE_ANALYSIS_CONFIG,
} from './ai.contants';
import { AiService } from './ai.service';
import {
  ExtractInformationInput,
  ImageExtractionInput,
  OcrExtractionInput,
} from './ai.types';
import {
  ConfidenceSchema,
  DataExtractionSchema,
  ImageAnalysisSchema,
} from './ocr.dto';

export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name);
  constructor(
    private readonly aiService: AiService,
    private readonly prismaService: PrismaService,
  ) {}

  private getDataExtractionPrompt(
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
    source: 'ocr' | 'img',
    extractedText?: string,
  ): string {
    const baseInstructions = `
        You are a specialized document data extraction AI. Extract ONLY the document information.

        DOCUMENT TYPES TO HANDLE:
        ${documentTypes.map((type) => `- ${type.id}: ${type.name} (${type.category})`).join('\n')}

        EXTRACTION RULES:
        1. Extract ALL relevant personal identification information
        2. Format dates as ISO strings (YYYY-MM-DD)
        3. For "gender", only use: "Male", "Female", or "Unknown"
        4. "ownerName" and "typeId" are REQUIRED
        5. If you cannot find a field, omit it (don't include undefined/null)
        6. Generate 3-5 security questions based on EXTRACTED information only
        7. Security questions should be specific and verifiable from the document
        8. Prioritize less obvious questions (avoid "What is your name?")

        OUTPUT SCHEMA (return ONLY valid JSON, no markdown):
        {
        "serialNumber": "string (optional)",
        "documentNumber": "string (optional)",
        "batchNumber": "string (optional)",
        "issuer": "string (optional)",
        "ownerName": "REQUIRED string",
        "dateOfBirth": "YYYY-MM-DD (optional)",
        "placeOfBirth": "string (optional)",
        "placeOfIssue": "string (optional)",
        "gender": "Male" | "Female" | "Unknown" (optional),
        "note": "string (optional)",
        "typeId": "REQUIRED string from document types list",
        "issuanceDate": "YYYY-MM-DD (optional)",
        "expiryDate": "YYYY-MM-DD (optional)",
        "additionalFields": [
            {
            "fieldName": "string",
            "fieldValue": "string"
            }
        ],
        "securityQuestions": [
            {
            "question": "string",
            "answer": "string (from extracted data)"
            }
        ]
        }

        EXAMPLE OUTPUT:
        {
        "documentNumber": "12345678",
        "issuer": "REPUBLIC OF KENYA",
        "ownerName": "JOHN KAMAU DOE",
        "dateOfBirth": "1990-01-15",
        "gender": "Male",
        "placeOfBirth": "NAIROBI",
        "typeId": "uuid-of-national-id-type",
        "issuanceDate": "2018-03-20",
        "serialNumber": "A1234567",
        "additionalFields": [
            {
            "fieldName": "District",
            "fieldValue": "NAIROBI"
            }
        ],
        "securityQuestions": [
            {
            "question": "What is your ID serial number?",
            "answer": "A1234567"
            },
            {
            "question": "In which year was your ID issued?",
            "answer": "2018"
            },
            {
            "question": "What district is listed on your ID?",
            "answer": "NAIROBI"
            }
        ]
        }
    `;

    if (source === 'ocr') {
      return `
        ${baseInstructions}

        OCR CONSIDERATIONS:
        - Text contains OCR errors (O vs 0, I vs 1 vs l, etc.)
        - Missing or extra spaces, merged/split words
        - Be flexible and recognize fields despite errors
        - Attempt to correct obvious OCR mistakes

        TEXT TO ANALYZE:
        ${extractedText}

        Extract the information and return ONLY valid JSON.
        `;
    } else {
      return `
        ${baseInstructions}

        IMAGE ANALYSIS INSTRUCTIONS:
        - Use your vision capabilities to read the document images
        - Handle blurred, skewed, or partially obscured documents
        - Parse both handwritten and printed text
        - Recognize official seals, logos, stamps to deduce issuer/type
        - If text is illegible, omit that field

        Analyze the provided images and return ONLY valid JSON.
        `;
    }
  }

  private getConfidencePrompt(extractedData: any, imageCount: number): string {
    return `
        You are an AI confidence scorer. Evaluate the confidence of each extracted field.

        EXTRACTED DATA:
        ${JSON.stringify(extractedData, null, 2)}

        NUMBER OF IMAGES ANALYZED: ${imageCount}

        CONFIDENCE SCORING RULES:
        1. Score each field from 0.0 to 1.0
        2. Consider:
        - Text clarity and readability
        - Whether field was clearly visible
        - OCR quality (if applicable)
        - Consistency across multiple images
        - Document quality

        3. Scoring Guidelines:
        - 0.95-1.0: Extremely clear, no doubt
        - 0.85-0.94: Very clear, minor uncertainty
        - 0.70-0.84: Readable but some quality issues
        - 0.50-0.69: Difficult to read, uncertain
        - 0.0-0.49: Very poor quality, guessing

        4. Lower scores if:
        - Text was blurred or damaged
        - OCR errors likely
        - Field partially obscured
        - Unusual formatting

        OUTPUT FORMAT (return ONLY valid JSON, no markdown):
        {
        "serialNumber": 0.95,
        "documentNumber": 0.99,
        "ownerName": 0.92,
        "dateOfBirth": 0.98,
        "gender": 0.99,
        "placeOfBirth": 0.88,
        "issuer": 0.96,
        "typeId": 1.0,
        "issuanceDate": 0.94,
        "expiryDate": 0.90
        }

        IMPORTANT:
        - Include scores for ALL fields in the extracted data
        - If a field was omitted due to poor quality, don't include it
        - Be conservative - better to underestimate than overestimate
        - Return ONLY the JSON object, no explanations    
    `;
  }

  private getImageAnalysisPrompt(
    extractedData: any,
    imageCount: number,
  ): string {
    return `
        You are an image quality analysis AI. Analyze the quality of document images used for extraction.

        NUMBER OF IMAGES: ${imageCount}

        EXTRACTED DATA (for context):
        ${JSON.stringify(extractedData, null, 2)}

        ANALYSIS REQUIREMENTS:
        For EACH image, evaluate:
        1. Overall quality (0.0-1.0): Resolution, clarity, sharpness
        2. Readability (0.0-1.0): How easy to read text
        3. Focus (0.0-1.0): Image sharpness
        4. Lighting (0.0-1.0): Proper exposure, no glare
        5. Tampering detection: Any signs of digital manipulation
        7. Warnings: Specific issues noticed
        8. Usable: Whether image is good enough for extraction

        QUALITY SCORING:
        - 0.90-1.0: Excellent quality
        - 0.75-0.89: Good quality
        - 0.60-0.74: Acceptable but has issues
        - 0.40-0.59: Poor quality
        - 0.0-0.39: Very poor, unusable

        TAMPERING INDICATORS:
        - Inconsistent lighting/shadows
        - Mismatched fonts or colors
        - Copy-paste artifacts
        - Pixelation inconsistencies
        - Unnatural edges or boundaries

        OUTPUT FORMAT (return ONLY valid JSON array, no markdown):
        [
        {
            "index": 0,
            "imageType": "front",
            "quality": 0.88,
            "readability": 0.92,
            "focus": 0.85,
            "lighting": 0.90,
            "tamperingDetected": false,
            "warnings": ["slight blur on bottom corner"],
            "usableForExtraction": true
        },
        {
            "index": 1,
            "imageType": "back",
            "quality": 0.92,
            "readability": 0.95,
            "focus": 0.90,
            "lighting": 0.88,
            "tamperingDetected": false,
            "warnings": [],
            "usableForExtraction": true
        }
        ]

        IMPORTANT:
        - Return an array with ${imageCount} objects
        - Each object represents one image in order (index 0, 1, 2, ...)
        - Be honest about quality issues
        - Flag tampering if you see ANY suspicious indicators
        - Return ONLY the JSON array, no explanations
    `;
  }

  private getInteructionConfig(
    interactionType: AIInteractionType,
  ): GenerateContentConfig {
    switch (interactionType) {
      case AIInteractionType.DATA_EXTRACTION:
        return AI_DATA_EXTRACT_CONFIG;
      case AIInteractionType.CONFIDENCE_SCORE:
        return AI_CONFIDENCE_CONFIG;
      case AIInteractionType.IMAGE_ANALYSIS:
        return AI_IMAGE_ANALYSIS_CONFIG;
      default:
        throw new BadRequestException('Invalid interaction type');
    }
  }

  private async callAIAndStore(
    prompt: string,
    files: Array<{ buffer: Buffer; mimeType: string }> | undefined,
    interactionType: AIInteractionType,
    entityType: string,
    userId?: string,
  ) {
    let responseText = '';
    let aiResponse: GenerateContentResponse | null = null;

    try {
      const parts = [
        { text: prompt },
        ...(files
          ? files.map((file) =>
              this.aiService.fileToGenerativePart(file.buffer, file.mimeType),
            )
          : []),
      ];

      aiResponse = await this.aiService.generateContent(
        parts,
        this.getInteructionConfig(interactionType),
      );
      responseText = aiResponse.text?.trim() ?? '';

      return await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt.substring(0, 10000), // Truncate for storage
          response: responseText,
          aiModel: this.aiService.options.model,
          modelVersion: aiResponse?.modelVersion,
          interactionType,
          entityType,
          tokenUsage: aiResponse?.usageMetadata as any,
          success: true,
          userId,
        },
      });
    } catch (error: any) {
      this.logger.warn(`Error in ${interactionType}:`, error);
      return await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt.substring(0, 10000),
          response: responseText,
          aiModel: this.aiService.options.model,
          modelVersion: aiResponse?.modelVersion,
          interactionType,
          entityType,
          tokenUsage: aiResponse?.usageMetadata as any,
          errorMessage: error?.message ?? 'Unknown error',
          success: false,
          userId,
        },
      });
    }
  }

  async extractInformation(input: ExtractInformationInput) {
    this.logger.log('Starting three-step extraction process...');
    // Get document types once
    const documentTypes = await this.prismaService.documentType.findMany({
      select: { id: true, name: true, category: true },
    });

    // ============= STEP 1: EXTRACT DATA =============
    this.logger.log('Step 1: Extracting document data...');

    const dataPrompt = this.getDataExtractionPrompt(
      documentTypes,
      input.source,
      (input as OcrExtractionInput).extractedText,
    );

    const dataResult = await this.callAIAndStore(
      dataPrompt,
      input.source === 'img' ? input.files : undefined,
      AIInteractionType.DATA_EXTRACTION,
      'Document',
      input.userId,
    );

    if (!dataResult.success) {
      await this.prismaService.aIExtraction.create({
        data: {
          aiextractionInteractions: {
            create: {
              aiInteractionId: dataResult.id,
              extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
              errorMessage: dataResult.errorMessage,
              success: false,
            },
          },
        },
      });
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
      await this.prismaService.aIExtraction.create({
        data: {
          aiextractionInteractions: {
            create: {
              aiInteractionId: dataResult.id,
              extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
              errorMessage: dataParsedResult.error.message,
              success: false,
            },
          },
        },
      });
      this.logger.error(
        'Data extraction validation failed:',
        dataParsedResult.error,
      );
      throw new BadRequestException(
        `Data extraction failed: ${dataParsedResult.error.message}`,
      );
    }

    const dataValidation = await DataExtractionSchema.safeParseAsync(
      dataParsedResult.data,
    );

    if (!dataValidation.success) {
      await this.prismaService.aIExtraction.create({
        data: {
          aiextractionInteractions: {
            create: {
              aiInteractionId: dataResult.id,
              extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
              errorMessage: JSON.stringify(z.formatError(dataValidation.error)),
              success: false,
            },
          },
        },
      });
      this.logger.error(
        'Data extraction validation failed:',
        dataValidation.error,
      );
      throw new BadRequestException(
        `Data extraction validation failed: ${JSON.stringify(dataValidation.error.issues)}`,
      );
    }

    const extractedData = dataValidation.data;
    this.logger.log('Step 1 completed: Data extracted successfully');

    // ============= STEP 2: CALCULATE CONFIDENCE =============
    this.logger.log('Step 2: Calculating confidence scores...');

    const confidencePrompt = this.getConfidencePrompt(
      extractedData,
      (input as ImageExtractionInput).files?.length ?? 1,
    );

    const confidenceResult = await this.callAIAndStore(
      confidencePrompt,
      input.source === 'img' ? input.files : undefined,
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
      await this.prismaService.aIExtraction.create({
        data: {
          aiextractionInteractions: {
            createMany: {
              data: [
                // Because it parsed the data extraction successfully, we can add the data to the extraction
                {
                  aiInteractionId: dataResult.id,
                  extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
                  extractionData: extractedData,
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
      await this.prismaService.aIExtraction.create({
        data: {
          aiextractionInteractions: {
            createMany: {
              data: [
                {
                  aiInteractionId: dataResult.id,
                  extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
                  extractionData: extractedData,
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
    this.logger.log('Step 2 completed: Confidence scores calculated');

    // ============= STEP 3: ANALYZE IMAGES =============
    this.logger.log('Step 3: Analyzing image quality...');

    const imagePrompt = this.getImageAnalysisPrompt(
      extractedData,
      (input as ImageExtractionInput).files?.length ?? 1,
    );

    const imageResult = await this.callAIAndStore(
      imagePrompt,
      input.source === 'img' ? input.files : undefined,
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
      await this.prismaService.aIExtraction.create({
        data: {
          aiextractionInteractions: {
            createMany: {
              data: [
                // Because it parsed the data extraction and confidence successfully, we can add the data to the extraction
                {
                  aiInteractionId: dataResult.id,
                  extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
                  extractionData: extractedData,
                },
                {
                  aiInteractionId: confidenceResult.id,
                  extractionType: AIExtractionInteractionType.CONFIDENCE_SCORE,
                  extractionData: confidence,
                },
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
      await this.prismaService.aIExtraction.create({
        data: {
          aiextractionInteractions: {
            createMany: {
              // Because it parsed the data extraction and confidence successfully, we can add the data to the extraction
              data: [
                {
                  aiInteractionId: dataResult.id,
                  extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
                  extractionData: extractedData,
                },
                {
                  aiInteractionId: confidenceResult.id,
                  extractionType: AIExtractionInteractionType.CONFIDENCE_SCORE,
                  extractionData: confidence,
                },
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
    this.logger.log('Step 3 completed: Image analysis finished');

    // ============= CREATE FINAL EXTRACTION RECORD =============
    this.logger.log('Creating final extraction record...');

    const extraction = await this.prismaService.aIExtraction.create({
      data: {
        aiextractionInteractions: {
          createMany: {
            data: [
              {
                aiInteractionId: dataResult.id,
                extractionData: extractedData,
                extractionType: AIExtractionInteractionType.DATA_EXTRACTION,
              },
              {
                aiInteractionId: confidenceResult.id,
                extractionData: confidence,
                extractionType: AIExtractionInteractionType.CONFIDENCE_SCORE,
              },
              {
                aiInteractionId: imageResult.id,
                extractionData: imageAnalysis,
                extractionType: AIExtractionInteractionType.IMAGE_ANALYSIS,
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
