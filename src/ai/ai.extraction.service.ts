/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { GenerateContentResponse } from '@google/genai';
import { BadRequestException, Logger } from '@nestjs/common';
import z from 'zod';
import {
  AIInteraction,
  AIInteractionType,
  DocumentType,
} from '../../generated/prisma/client';
import { nullToUndefined } from '../app.utils';
import { PrismaService } from '../prisma/prisma.service';
import { AI_EXTRACT_CONFIG } from './ai.contants';
import { AiService } from './ai.service';
import { ExtractInformationInput } from './ai.types';
import { DocAiExtractSchema } from './ocr.dto';

export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name);
  constructor(
    private readonly aiService: AiService,
    private readonly prismaService: PrismaService,
  ) {}

  private getOcrExtractionPrompt(
    extractedText: string,
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
  ) {
    return `
        You are a specialized document information extraction system analyzing text from personal documents that has been extracted via OCR (Optical Character Recognition).
        TASK:
        Extract all relevant information from the provided OCR-extracted text and format it to match the specified document model schema.

        IMPORTANT OCR CONSIDERATIONS:
        - The text has been extracted from images using OCR and likely contains errors
        - Common OCR errors include:
          * Character misrecognition (e.g., '0' vs 'O', '1' vs 'I' vs 'l', '5' vs 'S')
          * Missing or extra spaces
          * Missing characters or words
          * Random line breaks disrupting content flow
          * Merged or split words
          * Formatting loss and text rearrangement
        - You must be flexible and recognize fields even when they contain OCR errors

        DOCUMENT TYPES TO HANDLE:
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

        OUTPUT SCHEMA:
        Return your findings as a JSON object that strictly follows this schema:
        {
          "serialNumber": string,
          "documentNumber": string,
          "batchNumber": string,
          "issuer": string,
          "ownerName": string,
          "dateOfBirth": string, // Format as ISO date string (YYYY-MM-DD)
          "placeOfBirth": string,
          "placeOfIssue": string,
          "gender": "Male" or "Female" or "Unknown" (Uknown when not provided or found),
          "note": string,
          "typeId": string, // Document type id (based on the following document types provided: 
          // ${documentTypes.map((type) => `${type.id} - ${type.name} (${type.category})`).join(', ')})
          "issuanceDate": string, // Format as ISO date string (YYYY-MM-DD)
          "expiryDate": string, // Format as ISO date string (YYYY-MM-DD)
          "additionalFields": [
            {
              "fieldName": string,
              "fieldValue": string
            },
            ...
          ]
        }

        INSTRUCTIONS:
        1. Extract ALL relevant personal identification information that matches the schema
        2. Map extracted information to the corresponding fields in the schema:
          - Standard fields like name, dates, document numbers directly to their schema fields
          - Any other information that doesn't fit the standard fields into "additionalFields" array
        3. Format dates as ISO strings (YYYY-MM-DD) when possible
        4. Ensure "ownerName" and "typeId" are always provided, as they are required fields
        5. For "gender", only use values from the enum: "Male", "Female", or "Unknown"
        6. If you cannot extract a required field, use a best guess or placeholder
        7. If no relevant information exists at all, return an empty object: {}
        8. Do NOT include explanations or notes about OCR errors in the values
        9. Attempt to correct obvious OCR errors in the extracted values
        10. If the document dont fall in the provided document types, return an empty object: {}
        11. If the document is not a personal identification document, return an empty object: {}
        12. From the extracted information, generate a list of security questions and answers that are relevant to the document and is used to verify ownership of the document.
        13. The security questions and answers should be in the following format:
          {
            "question": string,
            "answer": string,
          }
          The question should answer the information extracted from the document, and the answer should be the answer to the question.
          The question should be in the language of the document, and the answer should be in the language of the document.
          The number of security questions and answers should be 3-5.
          The answer MUST BE from the information extracted
          When generating questions prioritize in more private and less obvious questions.
        14. If the field value is not found, leave it undefined i.e dont include it in the object.Bellow is the zod validation schema for the output
          const DocAiExtractSchema = z.object({
          serialNumber: z.string().optional(),
          documentNumber: z.string().optional(),
          batchNumber: z.string().optional(),
          issuer: z.string().optional(),
          ownerName: z.string(),
          dateOfBirth: z.string().optional(),
          placeOfBirth: z.string().optional(),
          placeOfIssue: z.string().optional(),
          gender: z.enum(['Male', 'Female', 'Unknown']).optional(),
          note: z.string().optional(),
          typeId: z.string(),
          issuanceDate: z.string().optional(),
          expiryDate: z.string().optional(),
          additionalFields: z
            .object({
              fieldName: z.string(),
              fieldValue: z.string(),
            })
            .array()
            .optional(),
          securityQuestions: z
            .object({
              question: z.string(),
              answer: z.string(),
            })
            .array()
            .optional(),
        });

        DATE HANDLING:
        - Convert all dates to ISO format (YYYY-MM-DD)
        - Be flexible with date formats in the input (MM/DD/YYYY, DD-MM-YYYY, etc.)
        - If you can only extract a partial date, make a reasonable attempt to complete it

        ADDITIONAL FIELDS:
        - Use the additionalFields array for any extracted information that doesn't fit the main schema
        - Each additional field should have a descriptive fieldName and corresponding fieldValue
        - Examples of additional fields: height, eye color, restrictions, vehicle class, etc.

        EXAMPLES:
        1. For passport with OCR errors: "PASSFORT 0F USA / SMlTH, J0HN MlCHAEL / D0B: O1 JAN l99O / PASSPORT N0: A12345678 / lSSUED: O1 JAN 2O2O / EXPlRES: O1 JAN 203O"
          Return: {
            "documentNumber": "A12345678",
            "issuer": "USA",
            "ownerName": "SMITH, JOHN MICHAEL",
            "dateOfBirth": "1990-01-01",
            "typeId": "<passport_id>",
            "issuanceDate": "2020-01-01",
            "expiryDate": "2030-01-01",
            "additionalFields": []
            "securityQuestions": [
                {
                  "question": "What is the name of the owner?",
                  "answer": "SMITH, JOHN MICHAEL"
                },
                {
                  "question": "What is the date of birth of the owner?",
                  "answer": "1990-01-01"
                },
                {
                  "question": "What is the document number?",
                  "answer": "A12345678"
                }
              ]
          }

        2. For poorly OCR'd driver's license: "DRlVER LlCENSE / STATE 0F EXAMPLE / DL#: Dl234567 / JANE D0E / l23 MAlN ST, ANYT0WN / D0B: O2/l5/l985 / EXP: O6/3O/2O26 / CLASS: C"
          Return: {
            "documentNumber": "D1234567",
            "issuer": "STATE OF EXAMPLE",
            "ownerName": "JANE DOE",
            "dateOfBirth": "1985-02-15",
            "typeId": "<driver_license_id>",
            "expiryDate": "2026-06-30",
            "additionalFields": [
              {
                "fieldName": "Address",
                "fieldValue": "123 MAIN ST, ANYTOWN"
              },
              {
                "fieldName": "License Class",
                "fieldValue": "C"
              }
            ],
            "securityQuestions": [
                {
                  "question": "What is the name of the owner?",
                  "answer": "JANE DOE"
                },
                {
                  "question": "What is the date of birth of the owner?",
                  "answer": "1985-02-15"
                },
              ]
          }

          TEXT TO ANALYZE (OCR-EXTRACTED):
          ${extractedText}
      `;
  }

  private getImageExtractionPrompt(
    documentTypes: Array<Pick<DocumentType, 'id' | 'name' | 'category'>>,
  ) {
    return `
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
      - Note any damage, tampering, or quality issues
      - Confidence scores should be between 0 and 1
      - Be conservative with confidence scores - it's better to be uncertain than wrong
      - Flag any signs of tampering, damage, or poor quality in the imageAnalysis object
      - Confidence scores: 
        - In the "confidence" object, provide a numeric score between 0 and 1 for EVERY extracted field in "data" (even if null/missing). 
        - Prefer a lower score if uncertain or if the field is missing/illegible. 
        - The keys in the confidence object must match the keys in "data", excluding arrays like "additionalFields" or "securityQuestions".

      SCHEMA FOR OUTPUT (return a single JSON object matching this shape):
      {
        "data": {
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
          "typeId": string,                    // Use the "id" from this list of supported document types:${documentTypes.map((type) => `${type.id} - ${type.name} (${type.category})`).join(', ')})
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
        },
        "confidence": {
          "documentNumber": 0.95,
          "ownerName": 0.88,
          "dateOfBirth": 0.92,
          // Confidence score (0-1) for each extracted field
        },
        "imageAnalysis": [
          {
            "index": 0,
            "quality": 0.85,
            "readability": 0.90,
            "tamperingDetected": false,
            "warnings": ["slight blur on bottom right corner"]
          }
        ],
      }

      EXAMPLES OF GOOD OUTPUT:

      1. For a clear passport photo:
      {
        "data": {
          "documentNumber": "A12345678",
          "ownerName": "JOHN DOE",
          "dateOfBirth": "1990-01-01",
          "issuer": "Countryland Government",
          "typeId": "<type id for passport>",
          "expiryDate": "2032-12-31",
          "gender": "Male",
          "serialNumber": "P123456",
          "placeOfBirth": "Capital City",
          "placeOfIssue": "Capital City",
          "note": "None",
          "additionalFields": [
            { "fieldName": "Nationality", "fieldValue": "Countryland" }
          ],
          "securityQuestions": [
            { "question": "What is the document number?", "answer": "A12345678" },
            { "question": "What is the owner's full name?", "answer": "JOHN DOE" }
          ]
        },
        "confidence": {
          "documentNumber": 0.97,
          "ownerName": 0.94,
          "dateOfBirth": 0.91,
          "issuer": 0.90,
          "typeId": 1,
          "expiryDate": 0.99,
          "additionalFields": [
            { "fieldName": "Nationality", "fieldValue": "Countryland", "nameScore": 0.97, "valueScore": 0.97 }
          ],
          "securityQuestions": [
            { "question": "What is the document number?", "answer": "A12345678", "questionScore": 0.97, "answerScore": 0.97 },
            { "question": "What is the owner's full name?", "answer": "JOHN DOE", "questionScore": 0.97, "answerScore": 0.97 }
          ]
        },
        "imageAnalysis": [
          {
            "index": 0,
            "imageType": "Front",
            "quality": 0.93,
            "readability": 0.95,
            "tamperingDetected": false,
            "warnings": []
          }
        ],
      }

      2. For a license image with both front and back:
      {
        "data": {
          "documentNumber": "D1234567",
          "ownerName": "JANE DOE",
          "dateOfBirth": "1985-02-15",
          "typeId": "<type id for driver's license>",
          "issuer": "STATE OF EXAMPLE",
          "expiryDate": "2026-06-30",
          "gender": "Female",
          "serialNumber": "L987654",
          "placeOfBirth": "ANYTOWN",
          "placeOfIssue": "STATE OF EXAMPLE",
          "additionalFields": [
            { "fieldName": "Address", "fieldValue": "123 MAIN ST, ANYTOWN" },
            { "fieldName": "License Class", "fieldValue": "C" }
          ],
          "securityQuestions": [
            { "question": "What is the document number?", "answer": "D1234567" },
            { "question": "What is the owner's full name?", "answer": "JANE DOE" }
          ]
        },
        "confidence": {
          "documentNumber": 0.96,
          "ownerName": 0.91,
          "dateOfBirth": 0.90,
          "issuer": 0.92,
          "typeId": 1,
          "expiryDate": 0.97,
          "additionalFields": [
            { "fieldName": "Address", "fieldValue": "123 MAIN ST, ANYTOWN", "nameScore": 0.96, "valueScore": 0.96 },
            { "fieldName": "License Class", "fieldValue": "C", "nameScore": 0.96, "valueScore": 0.96 }
          ],
          "securityQuestions": [
            { "question": "What is the document number?", "answer": "D1234567", "questionScore": 0.96, "answerScore": 0.96 },
            { "question": "What is the owner's full name?", "answer": "JANE DOE", "questionScore": 0.96, "answerScore": 0.96 }
          ]
        },
        "imageAnalysis": [
          {
            "index": 0,
            "imageType": "Front",
            "quality": 0.88,
            "readability": 0.90,
            "tamperingDetected": false,
            "warnings": ["slight blur on bottom right corner"]
          }
          {
            "index": 1,
            "imageType": "Back",
            "quality": 0.88,
            "readability": 0.90,
            "tamperingDetected": false,
            "warnings": ["slight blur on bottom right corner"]
          }
        ],
      }

      PROCESS:
      - Visually analyze all uploaded images.
      - Use your expert OCR, context awareness, and reasoning to organize the fields.
      - Output a single, valid JSON object conforming to the schema above.
      - Return ONLY valid JSON, no markdown formatting, no extra text, no extra lines, no extra spaces, no extra characters, no extra anything.
    `;
  }

  private async scanAsStream(input: ExtractInformationInput) {
    let prompt: string = '';
    let responseText: string = '';
    let lastChunck: GenerateContentResponse | null = null;
    try {
      const documentTypes = await this.prismaService.documentType.findMany({
        select: {
          id: true,
          name: true,
          category: true,
        },
      });

      if (input.source === 'ocr') {
        prompt = this.getOcrExtractionPrompt(
          input.extractedText,
          documentTypes,
        );
      } else {
        prompt = this.getImageExtractionPrompt(documentTypes);
      }

      this.logger.debug(`Prompt: ${prompt}`);

      // The configuration object is the same, but we call streamGenerateContent
      const stream = await this.aiService.generateContentStream(
        [
          { text: prompt },
          ...(input.source === 'img'
            ? input.files.map((file) =>
                this.aiService.fileToGenerativePart(file.buffer, file.mimeType),
              )
            : []),
        ],
        AI_EXTRACT_CONFIG,
      );

      // Aggregate all text chunks from the stream
      for await (const chunk of stream) {
        responseText += chunk?.text?.trim() ?? '';
        lastChunck = chunk;
      }
      this.logger.debug(`Response Text: ${responseText}`);
      const aiInteraction = await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt,
          response: responseText,
          aiModel: this.aiService.options.model,
          interactionType: AIInteractionType.DOCUMENT_EXTRACTION,
          entityType: 'Document',
          modelVersion: lastChunck?.modelVersion,
          // entityId: input.documentId,
          tokenUsage: lastChunck?.usageMetadata as any,
        },
      });
      return aiInteraction;
    } catch (error: any) {
      this.logger.error('Error scanning and extracting information:', error);
      await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt,
          response: responseText,
          aiModel: this.aiService.options.model,
          interactionType: AIInteractionType.DOCUMENT_EXTRACTION,
          entityType: 'Document',
          modelVersion: lastChunck?.modelVersion,
          // entityId: input.documentId,
          tokenUsage: lastChunck?.usageMetadata as any,
          errorMessage: error?.message ?? 'Unknown error',
          success: false,
        },
      });
      throw new BadRequestException(
        'Failed to scan and extract document information',
      );
    }
  }

  private async scanAsResponse(input: ExtractInformationInput) {
    let prompt: string = '';
    let responseText: string = '';
    let response: GenerateContentResponse | null = null;
    try {
      const documentTypes = await this.prismaService.documentType.findMany({
        select: {
          id: true,
          name: true,
          category: true,
        },
      });

      if (input.source === 'ocr') {
        prompt = this.getOcrExtractionPrompt(
          input.extractedText,
          documentTypes,
        );
      } else {
        prompt = this.getImageExtractionPrompt(documentTypes);
      }

      this.logger.debug(`Prompt: ${prompt}`);

      // Use generateContent instead of generateContentStream
      response = await this.aiService.generateContent(
        [
          { text: prompt },
          ...(input.source === 'img'
            ? input.files.map((file) =>
                this.aiService.fileToGenerativePart(file.buffer, file.mimeType),
              )
            : []),
        ],
        AI_EXTRACT_CONFIG,
      );

      // Get response text directly (no streaming/chunk aggregation needed)
      responseText = response.text?.trim() ?? '';
      this.logger.debug(`Response Text: ${responseText}`);
      const aiInteraction = await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt,
          response: responseText,
          aiModel: this.aiService.options.model,
          interactionType: AIInteractionType.DOCUMENT_EXTRACTION,
          entityType: 'Document',
          modelVersion: response?.modelVersion,
          // entityId: input.documentId,
          tokenUsage: response?.usageMetadata as any,
        },
      });
      return aiInteraction;
    } catch (error: any) {
      this.logger.error('Error scanning and extracting information:', error);
      await this.prismaService.aIInteraction.create({
        data: {
          prompt: prompt,
          response: responseText,
          aiModel: this.aiService.options.model,
          interactionType: AIInteractionType.DOCUMENT_EXTRACTION,
          entityType: 'Document',
          modelVersion: response?.modelVersion,
          // entityId: input.documentId,
          tokenUsage: response?.usageMetadata as any,
          errorMessage: error?.message ?? 'Unknown error',
          success: false,
        },
      });
      throw new BadRequestException(
        'Failed to scan and extract document information',
      );
    }
  }

  private async extractInformationFromInteraction(
    aiInteraction: AIInteraction,
  ) {
    try {
      const aiResponse = nullToUndefined<Record<string, any>>(
        JSON.parse(
          this.aiService.cleanResponseText(aiInteraction.response),
        ) as Record<string, any>,
      );
      const validtion = await DocAiExtractSchema.safeParseAsync(aiResponse);
      if (!validtion.success) {
        await this.prismaService.aIExtraction.create({
          data: {
            aiInteractionId: aiInteraction.id,
            errorMessage: JSON.stringify(z.formatError(validtion.error)),
            success: false,
          },
        });
        throw new BadRequestException('Invalid extraction result');
      }

      return await this.prismaService.aIExtraction.create({
        data: {
          extractedData: validtion.data.data,
          confidence: validtion.data.confidence,
          imageAnalysis: validtion.data.imageAnalysis,
          aiInteractionId: aiInteraction.id,
          success: true,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        /* empty */
        // Avoid creating aiExtraction as its already created in zod validation failure block
      } else {
        await this.prismaService.aIExtraction.create({
          data: {
            aiInteractionId: aiInteraction.id,
            errorMessage: error?.message ?? 'Unknown error',
            success: false,
          },
        });
      }
      this.logger.error('Error extracting information:', error);
      throw new BadRequestException('Failed to extract document information');
    }
  }

  async extractInformation(input: ExtractInformationInput) {
    const aiInteraction = await this.scanAsStream(input);
    return await this.extractInformationFromInteraction(aiInteraction);
  }
}
