/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { GenerateContentConfig, GenerateContentResponse } from '@google/genai';
import { BadRequestException, Inject, Logger } from '@nestjs/common';
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
import { ExtractInformationInput } from './ai.types';
import {
  ConfidenceSchema,
  DataExtractionDto,
  DataExtractionSchema,
  ImageAnalysisSchema,
} from './ocr.dto';

export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name);
  constructor(
    private readonly aiService: AiService,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
  ) {}

  private getDataExtractionPrompt(
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
  ): string {
    const baseInstructions = `
        You are an advanced document information extraction AI with expert-level OCR (Optical Character Recognition) and document understanding capabilities.

        TASK:
        Analyze the provided image(s) of original personal/official documents. Extract and return all relevant information by visually interpreting the content. Your goal is to accurately recognize text, fields, and layout, and convert this information into a structured data object according to the described schema.

        HANDLED DOCUMENT TYPES (examples, not limited to):
            - National ID cards
            - Passports
            - Driver's licenses
            - Student IDs
            - Birth certificates
            - Marriage certificates
            - Professional licenses/certificates
            - Insurance cards
            - Social security/pension documents
            - Work permits/visas
            - Vaccination/medical records
            - Any other personally identifiable documents

        IMPORTANT INSTRUCTIONS:
        - Use your vision capabilities to read and interpret images, NOT just metadata or file names.
        - Handle blurred, skewed, or partially obscured documents; do your best to interpret visually.
        - Recognize typical fields and their variants, even if formatting or placement varies.
        - Account for official seals, logos, stamps, and barcodes/QRs to help deduce issuer/type.
        - Use visual context to deduce field semantics, even if not explicitly labeled.
        - Parse handwritten and printed text.
        - Return date fields in ISO format (YYYY-MM-DD).
        - If a field is uncertain or illegible, omit it or set its value to null. Do NOT hallucinate.
        - Return ONLY valid JSON, no markdown formatting, no extra text, no extra lines, no extra spaces, no extra characters, no extra anything.
        - Prioritize less obvious questions e.g what is the owners phone number;which is very obvious

        SCHEMA FOR OUTPUT (return a single JSON object matching this shape):
        {
            "serialNumber": string,              // Serial number on the document (if present)
            "documentNumber": string,            // Primary document number (passport/ID/license etc.)
            "batchNumber": string,               // Batch/lot/barcode/QR batch info
            "issuer": string,                    // Issuing country, authority, institution, or agency 
            "ownerName": string,                 // Person's full name as shown on document
            "dateOfBirth": string,               // Owner's birth date (YYYY-MM-DD)
            "placeOfBirth": string,              // Owner's place of birth (city/country, as shown)
            "placeOfIssue": string,              // Place where document is issued
            "gender": "Male" | "Female" | "Unknown", // Owner's gender (Unknown if not found)
            "note": string,                      // Any noted remarks or visible comments (optional)
            "typeId": string,                    // Use the "id" from this list of supported document types: ${JSON.stringify(documentTypes, null, 2)}
            "issuanceDate": string,              // Document's date of issue (YYYY-MM-DD)
            "expiryDate": string,                // Expiry/valid until (YYYY-MM-DD)
            "additionalFields": [                // Other fields as visually extracted, format:
            {
                "fieldName": string,
                "fieldValue": string
            }
            ],
            "securityQuestions": [               // Make 1-2 questions/answers based on data you extract, format:
            {
                "question": string,
                "answer": string
            }
            ]
        }

        EXAMPLES OF GOOD OUTPUT:

        1. For a clear passport photo: 
        {
            "documentNumber": "A12345678",
            "ownerName": "JOHN DOE",
            "dateOfBirth": "1990-01-01",
            "nationality": "Countryland",
            "typeId": "<type id for passport>", 
            "issuer": "Countryland Government",
            "expiryDate": "2032-12-31",
            "securityQuestions": [
            { "question": "What is the document number?", "answer": "A12345678" },
            { "question": "What is the document expiry date?", "answer": "2032-12-31" },
            { "question": "What is the owner's date of birth?", "answer": "1990-01-01" }
            ]
        }

        2. For a license image with both front and back:
        {
            "documentNumber": "D1234567",
            "ownerName": "JANE DOE",
            "dateOfBirth": "1985-02-15",
            "typeId": "<type id for driver's license>",
            "issuer": "STATE OF EXAMPLE",
            "expiryDate": "2026-06-30",
            "additionalFields": [
            { "fieldName": "Address", "fieldValue": "123 MAIN ST, ANYTOWN" },
            { "fieldName": "License Class", "fieldValue": "C" }
            ],
            "securityQuestions": [
            { "question": "What is the document number?", "answer": "D1234567" },
            { "question": "What is the owner's date of birth?", "answer": "1985-02-15" },
            { "question": "What is the document expiry date?", "answer": "2026-06-30" }
            ]
        }

        PROCESS:
        - Visually analyze all uploaded images.
        - Use your expert OCR, context awareness, and reasoning to organize the fields.
        - Output a single, valid JSON object conforming to the schema above.
        - Return ONLY valid JSON, no markdown formatting, no extra text, no extra lines, no extra spaces, no extra characters, no extra anything.
        
    `;

    return baseInstructions;
  }

  private getConfidencePrompt(extractedData: DataExtractionDto): string {
    return `
        You are an advanced document information extraction AI with expert-level OCR (Optical Character Recognition) and document understanding capabilities.
        Your task is to evaluate confidence scores as integer percentages (from 1 to 100, no decimals, no points) for EVERY field in the extracted data by VISUALLY VERIFYING each extracted value against the document images.

        TASK:
        Evaluate the confidence scores for EVERY field in the extracted data by VISUALLY VERIFYING each extracted value against the document images. Each confidence score must be a whole number integer from 1 to 100 (no decimals, no points).

        CRITICAL VERIFICATION PROCESS:
        - For EACH field in the extracted data, visually locate it in the provided document images
        - Compare the extracted value against what you can actually see in the images
        - Verify the accuracy of the extraction by checking:
          - Does the extracted text match what's visible in the image?
          - Is the field clearly readable in the image?
          - Are there any discrepancies between extracted value and image content?
          - How confident are you that the extraction is correct based on visual inspection?
        - Use the images as the PRIMARY source for determining confidence scores
        - If you cannot find a field in the images, significantly reduce its confidence score
        - If the extracted value doesn't match what you see, reduce the confidence score accordingly

        RETURN ONLY THE JSON OBJECT WITH THE CONFIDENCE SCORES:
        {
          "serialNumber": 95,
          "documentNumber": 99,
          "batchNumber": 88,
          "issuer": 96,
          "ownerName": 92,
          "dateOfBirth": 98,
          "placeOfBirth": 88,
          "placeOfIssue": 85,
          "gender": 99,
          "note": 90,
          "typeId": 100,
          "issuanceDate": 94,
          "expiryDate": 90,
          "additionalFields": [
            {
              "fieldName": "District",
              "nameScore": 95,
              "fieldValue": "NAIROBI",
              "valueScore": 92
            }
          ],
          "securityQuestions": [
            {
              "question": "What is your ID serial number?",
              "questionScore": 98,
              "answer": "A1234567",
              "answerScore": 95
            }
          ]
        }

        IMPORTANT REQUIREMENTS:
        - All confidence scores MUST be whole number integers from 1 to 100 (no decimals or points)
        - Return ONLY the JSON object, no markdown formatting, no code blocks
        - Include confidence scores for EVERY field that exists in the extracted data
        - If a field was not in the extracted data, DO NOT include it in the confidence response
        - The "additionalFields" array MUST include ALL items from extracted data with nameScore and valueScore for each
        - The "securityQuestions" array MUST include ALL questions from extracted data with questionScore and answerScore for each
        - Return ONLY the JSON object, no explanations, no markdown formatting, no extra text, no extra lines, no extra spaces, no extra characters, no extra anything.

        EXTRACTED DATA TO VERIFY AND SCORE:
        ${JSON.stringify(extractedData, null, 2)}

        REQUIRED OUTPUT STRUCTURE (return ONLY valid JSON, no markdown, no code blocks, scores as integers):
        {
          "serialNumber": 95,
          "documentNumber": 99,
          "batchNumber": 88,
          "issuer": 96,
          "ownerName": 92,
          "dateOfBirth": 98,
          "placeOfBirth": 88,
          "placeOfIssue": 85,
          "gender": 99,
          "note": 90,
          "typeId": 100,
          "issuanceDate": 94,
          "expiryDate": 90,
          "additionalFields": [
            {
              "fieldName": "District",
              "nameScore": 95,
              "fieldValue": "NAIROBI",
              "valueScore": 92
            }
          ],
          "securityQuestions": [
            {
              "question": "What is your ID serial number?",
              "questionScore": 98,
              "answer": "A1234567",
              "answerScore": 95
            }
          ]
        }
        
    `;
  }

  private getImageAnalysisPrompt(): string {
    return `
        You are an advanced image analysis AI with expert-level image understanding capabilities.

        TASK:
        Analyze ALL images and return a complete analysis for each one.

        For EACH image, you MUST evaluate and provide:
        1. "index" (REQUIRED): Sequential number starting from 0 (0, 1, 2, ...)
        2. "quality" (REQUIRED): Overall image quality score as an integer confidence percentage between 0 and 100 (resolution, clarity, sharpness)
        3. "readability" (REQUIRED): Text readability score as an integer confidence percentage between 0 and 100 (how easy it is to read text)
        4. "focus" (optional): Integer confidence percentage between 0 and 100 - image sharpness and focus quality
        5. "lighting" (optional): Integer confidence percentage between 0 and 100 - exposure quality, glare, shadows
        6. "tamperingDetected" (REQUIRED): Boolean - true if any signs of manipulation detected
        7. "warnings" (REQUIRED): Array of strings 
            - specific issues found (empty array [] if none)
            - should be as few as a maximum of 5 major issues, focusing on those that greatly affect extraction
            - each issue should be very brief and to the point (not more than 5 words)
        8. "imageType" (optional): String - e.g., "front", "back", "side", etc.
        9. "usableForExtraction" (optional): Boolean - whether image is usable for data extraction

        REQUIRED OUTPUT STRUCTURE (return ONLY valid JSON array, no markdown, no code blocks, confidence as integer percentages 0-100):
        [
          {
            "index": 0,
            "imageType": "front",
            "quality": 88,
            "readability": 92,
            "focus": 85,
            "lighting": 90,
            "tamperingDetected": false,
            "warnings": ["slight blur on bottom corner"],
            "usableForExtraction": true
          },
          {
            "index": 1,
            "imageType": "back",
            "quality": 92,
            "readability": 95,
            "focus": 90,
            "lighting": 88,
            "tamperingDetected": false,
            "warnings": [],
            "usableForExtraction": true
          }
        ]

        CRITICAL REQUIREMENTS:
        - You MUST analyze ALL images and return a complete analysis for each one.
        - You MUST return an array with EXACTLY objects
        - Each object MUST have: index, imageType, quality, readability, focus, lighting, tamperingDetected, warnings, usableForExtraction
        - The confidence scores ("quality", "readability", "focus", "lighting") MUST be whole number integers between 0 and 100 (no decimals).
        - Return ONLY the JSON array, no explanations, no markdown formatting
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

      aiResponse = await this.aiService.generateContentStream(
        parts,
        this.getInteructionConfig(interactionType),
      );
      responseText = aiResponse.text?.trim() ?? '';
      this.logger.log(`AI Response: ${responseText}`);

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

    const dataPrompt = this.getDataExtractionPrompt(documentTypes);

    const dataResult = await this.callAIAndStore(
      dataPrompt,
      input.files,
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

    const confidencePrompt = this.getConfidencePrompt(extractedData);

    const confidenceResult = await this.callAIAndStore(
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

    const imagePrompt = this.getImageAnalysisPrompt();

    const imageResult = await this.callAIAndStore(
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
