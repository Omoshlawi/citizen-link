/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  GenerateContentResponse,
  GoogleGenAI,
  Part,
  Type,
} from '@google/genai';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  AIInteraction,
  AIInteractionType,
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { nullToUndefined } from '../app.utils';
import { PrismaService } from '../prisma/prisma.service';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import { AIOptions, ExtractInformationInput } from './ai.types';
import { DocAiExtractDto, DocAiExtractSchema } from './ocr.dto';
import z from 'zod';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private genai: GoogleGenAI;
  constructor(
    @Inject(AI_OPTIONS_TOKEN)
    private readonly options: AIOptions,
    private readonly prismaService: PrismaService,
  ) {}
  onModuleInit() {
    this.genai = new GoogleGenAI({
      apiKey: this.options.geminiApiKey,
    });
  }
  /**
   * Converts a file buffer to a GenerativePart object with Base64 data.
   * @param {Buffer} buffer The file buffer.
   * @param {string} mimeType The MIME type of the file.
   */
  private fileToGenerativePart(buffer: Buffer, mimeType: string): Part {
    // Read the file as a Buffer and convert it to a Base64 string
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType,
      },
    };
  }

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

  private getMatchingPrompt(
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
    const prompt = `
    <document_matching_prompt>
    You are a document matching expert. Your task is to analyze two documents and determine if they belong to the same person.
    
    ## Documents to Compare

    ### FOUND DOCUMENT:
    ${JSON.stringify(foundCase, null, 2)}
    
    ### LOST DOCUMENT:
    ${JSON.stringify(lostCase, null, 2)}
    
    ## Field Importance Guide

    Consider these relative importance levels when analyzing:

    **CRITICAL IDENTIFIERS (Highest Weight):**
    - documentNumber: Unique identifier, should be exact or very close
    - serialNumber: Secondary unique identifier
    - dateOfBirth: Strong identifier, should match exactly (allow 1-2 day tolerance for data entry errors)

    **STRONG IDENTIFIERS (High Weight):**
    - ownerName: Should be very similar (account for typos, OCR errors, middle names, cultural variations)
    - gender: Should match exactly

    **MODERATE IDENTIFIERS (Medium Weight):**
    - placeOfBirth: Can have variations in spelling/formatting
    - issuer: Can vary if same person has multiple documents from different issuers
    - placeOfIssue: Similar to placeOfBirth

    **WEAK IDENTIFIERS (Low Weight):**
    - batchNumber: Not typically unique to individuals
    - issuanceDate: Same person can have documents issued at different times
    - expiryDate: Varies by document type and issuance date

    ## Matching Instructions

    1. **Compare each field systematically:**
      - Check for exact matches
      - Identify fuzzy matches (typos, OCR errors, formatting differences)
      - Note missing fields (don't penalize, just note)
      - Flag conflicting fields (e.g., same documentNumber but different DOB)

    2. **Consider context:**
      - Names: Account for cultural variations, maiden/married names, nicknames, transliterations
      - Dates: Allow small tolerances for data entry errors
      - Places: Account for different spellings, abbreviations, regional names
      - OCR errors: Common in scanned documents (O/0, I/1, S/5, etc.)

    3. **Identify red flags:**
      - Critical fields that conflict (e.g., different gender, vastly different DOB)
      - Suspicious exact matches (e.g., identical rare typos suggesting copy)
      - Impossible scenarios (e.g., document issued before birth)

    4. **Weight your analysis:**
      - Strong matches in critical fields = high confidence
      - Many moderate matches = medium confidence
      - Only weak field matches = low confidence
      - Any red flags = significantly reduce confidence

    ## Required Output Format

    You MUST respond with valid JSON in this exact structure:

    {
      "overallScore": <number 0-100>,
      "confidence": "<HIGH|MEDIUM|LOW|NO_MATCH>",
      "recommendation": "<SAME_PERSON|LIKELY_SAME|POSSIBLY_SAME|DIFFERENT_PERSON>",
      "reasoning": "<2-3 sentence explanation of your decision>",
      "fieldAnalysis": {
        "documentNumber": {
          "match": <boolean>,
          "similarity": <number 0-100>,
          "note": "<brief explanation if not exact match>"
        },
        "ownerName": {
          "match": <boolean>,
          "similarity": <number 0-100>,
          "note": "<brief explanation>"
        },
        "dateOfBirth": {
          "match": <boolean>,
          "similarity": <number 0-100>,
          "note": "<brief explanation if not exact>"
        },
        "gender": {
          "match": <boolean>,
          "similarity": <number 0-100>,
          "note": "<brief explanation if mismatch>"
        },
        // ... include all relevant fields that were compared
      },
      "matchingFields": [<array of field names that matched>],
      "conflictingFields": [<array of field names that conflicted>],
      "redFlags": [<array of concerning patterns or conflicts>],
      "confidenceFactors": {
        "strengths": [<reasons supporting match>],
        "weaknesses": [<reasons against match>]
      }
    }

    ## Scoring Guidelines

    - **90-100**: Virtual certainty - multiple critical fields match exactly
    - **80-89**: High confidence - critical fields match, minor variations in moderate fields
    - **70-79**: Good confidence - strong name match + DOB match, some other fields align
    - **60-69**: Moderate confidence - name similarity + some matching fields, but some gaps
    - **50-59**: Weak confidence - some similarities but significant gaps or minor conflicts
    - **40-49**: Low confidence - few matching fields, more differences than similarities
    - **0-39**: No match - critical fields conflict or completely different information

    ## Confidence Levels

    - **HIGH**: 80-100 score, recommend as SAME_PERSON or LIKELY_SAME
    - **MEDIUM**: 60-79 score, recommend as LIKELY_SAME or POSSIBLY_SAME
    - **LOW**: 40-59 score, recommend as POSSIBLY_SAME
    - **NO_MATCH**: 0-39 score, recommend as DIFFERENT_PERSON

    ## Important Notes

    - Missing fields should NOT be treated as mismatches - only compare fields that exist in both documents
    - Consider that the same person may have multiple document types (passport, ID, license)
    - Be culturally sensitive to name variations across different regions
    - Account for time gaps - a person's documents from different years are still the same person
    - OCR errors are common - be generous with minor character differences
    - When in doubt, err on the side of flagging for human review rather than making a definitive call

    Now analyze the two documents above and provide your response in the required JSON format.

    </document_matching_prompt>
    `;

    return prompt;
  }

  private async _extractInformation(
    input: ExtractInformationInput,
  ): Promise<DocAiExtractDto> {
    try {
      const documentTypes = await this.prismaService.documentType.findMany({
        select: {
          id: true,
          name: true,
          category: true,
        },
      });
      let prompt: string;
      if (input.source === 'ocr') {
        prompt = this.getOcrExtractionPrompt(
          input.extractedText,
          documentTypes,
        );
      } else {
        prompt = this.getImageExtractionPrompt(documentTypes);
      }
      this.logger.debug(`Prompt: ${prompt}`);
      const response = await this.genai.models.generateContent({
        model: this.options.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...(input.source === 'img'
                ? input.files.map((file) =>
                    this.fileToGenerativePart(file.buffer, file.mimeType),
                  )
                : []),
            ],
          },
        ],
        config: {
          temperature: 0.1, // Low temperature for more deterministic outputs
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              serialNumber: {
                type: Type.STRING,
                description: 'Serial number of the document',
                title: 'Serial Number',
                nullable: true,
              },
              documentNumber: {
                type: Type.STRING,
                description:
                  'Document number (unique identifier on most documents)',
                title: 'Document Number',
                nullable: true,
              },
              batchNumber: {
                type: Type.STRING,
                description: 'Batch number or barcode/QR batch',
                title: 'Batch Number',
                nullable: true,
              },
              issuer: {
                type: Type.STRING,
                description:
                  'Issuer (government, authority, country, state, etc.)',
                title: 'Issuer',
                nullable: true,
              },
              ownerName: {
                type: Type.STRING,
                description: "Owner's full name as printed on the document",
                title: 'Owner Name',
              },
              dateOfBirth: {
                type: Type.STRING,
                description: "Owner's date of birth (ISO: YYYY-MM-DD)",
                title: 'Date of Birth',
                nullable: true,
              },
              placeOfBirth: {
                type: Type.STRING,
                description: "Owner's place of birth (city, country, etc.)",
                title: 'Place of Birth',
                nullable: true,
              },
              placeOfIssue: {
                type: Type.STRING,
                description: 'Document place of issue (if available)',
                title: 'Place of Issue',
                nullable: true,
              },
              gender: {
                type: Type.STRING,
                description: "Owner's gender (Male, Female, Unknown)",
                enum: ['Male', 'Female', 'Unknown'],
                title: 'Gender',
                nullable: true,
              },
              note: {
                type: Type.STRING,
                description:
                  'Special notes, remarks or status found on the document',
                title: 'Note',
                nullable: true,
              },
              typeId: {
                type: Type.STRING,
                description:
                  'Document type identifier (should match one of the provided document types)',
                title: 'Type ID',
              },
              issuanceDate: {
                type: Type.STRING,
                description:
                  "Document's issuance/issue date (ISO format if possible)",
                title: 'Issuance Date',
                nullable: true,
              },
              expiryDate: {
                type: Type.STRING,
                description:
                  "Document's expiration/expiry date (ISO: YYYY-MM-DD)",
                title: 'Expiry Date',
                nullable: true,
              },
              additionalFields: {
                type: Type.ARRAY,
                description:
                  'Additional fields found on the document that do not fit standard categories',
                title: 'Additional Fields',
                nullable: true,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fieldName: {
                      type: Type.STRING,
                      description: 'Name of the field',
                      title: 'Field Name',
                    },
                    fieldValue: {
                      type: Type.STRING,
                      description: 'Value of the field',
                      title: 'Field Value',
                    },
                  },
                },
              },
              securityQuestions: {
                type: Type.ARRAY,
                description:
                  'Security questions and answers derived from document content',
                title: 'Security Questions',
                nullable: true,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: {
                      type: Type.STRING,
                      title: 'Question',
                      description: 'Security question',
                    },
                    answer: {
                      type: Type.STRING,
                      title: 'Answer',
                      description: 'Answer to the question',
                    },
                  },
                },
              },
            },
            // required: ['ownerName'],
          },
        },
      });
      const responseText = response.text!.trim();
      this.logger.debug(`Response Text: ${responseText}`);
      // Parse JSON from the response
      const extractedInfo = nullToUndefined<Record<string, any>>(
        JSON.parse(responseText),
      );
      this.logger.debug('Extracted Information: ', extractedInfo);
      const vlidation = await DocAiExtractSchema.safeParseAsync(extractedInfo);
      if (!vlidation.success) {
        this.logger.error('Invalid extraction result', vlidation.error);
        throw new BadRequestException('Invalid extraction result');
      }

      // Return the structured information or empty object if nothing extracted
      return vlidation.data;
    } catch (error) {
      console.error('Error extracting information:', error);
      throw error;
    }
  }

  private async scan(input: ExtractInformationInput) {
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
      const stream = await this.genai.models.generateContentStream({
        model: this.options.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              ...(input.source === 'img'
                ? input.files.map((file) =>
                    this.fileToGenerativePart(file.buffer, file.mimeType),
                  )
                : []),
            ],
          },
        ],
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json', // Critical for structured output
          maxOutputTokens: 2048,
          // NOTE: The responseSchema is identical to your original code
          responseSchema: {
            // ... your full JSON schema ...
            type: Type.OBJECT,
            properties: {
              data: {
                type: Type.OBJECT,
                properties: {
                  serialNumber: {
                    type: Type.STRING,
                    description: 'Serial number of the document',
                    title: 'Serial Number',
                    nullable: true,
                  },
                  documentNumber: {
                    type: Type.STRING,
                    description:
                      'Document number (unique identifier on most documents)',
                    title: 'Document Number',
                    nullable: true,
                  },
                  batchNumber: {
                    type: Type.STRING,
                    description: 'Batch number or barcode/QR batch',
                    title: 'Batch Number',
                    nullable: true,
                  },
                  issuer: {
                    type: Type.STRING,
                    description:
                      'Issuer (government, authority, country, state, etc.)',
                    title: 'Issuer',
                    nullable: true,
                  },
                  ownerName: {
                    type: Type.STRING,
                    description: "Owner's full name as printed on the document",
                    title: 'Owner Name',
                  },
                  dateOfBirth: {
                    type: Type.STRING,
                    description: "Owner's date of birth (ISO: YYYY-MM-DD)",
                    title: 'Date of Birth',
                    nullable: true,
                  },
                  placeOfBirth: {
                    type: Type.STRING,
                    description: "Owner's place of birth (city, country, etc.)",
                    title: 'Place of Birth',
                    nullable: true,
                  },
                  placeOfIssue: {
                    type: Type.STRING,
                    description: 'Document place of issue (if available)',
                    title: 'Place of Issue',
                    nullable: true,
                  },
                  gender: {
                    type: Type.STRING,
                    description: "Owner's gender (Male, Female, Unknown)",
                    enum: ['Male', 'Female', 'Unknown'],
                    title: 'Gender',
                    nullable: true,
                  },
                  note: {
                    type: Type.STRING,
                    description:
                      'Special notes, remarks or status found on the document',
                    title: 'Note',
                    nullable: true,
                  },
                  typeId: {
                    type: Type.STRING,
                    description:
                      'Document type identifier (should match one of the provided document types)',
                    title: 'Type ID',
                  },
                  issuanceDate: {
                    type: Type.STRING,
                    description:
                      "Document's issuance/issue date (ISO format if possible)",
                    title: 'Issuance Date',
                    nullable: true,
                  },
                  expiryDate: {
                    type: Type.STRING,
                    description:
                      "Document's expiration/expiry date (ISO: YYYY-MM-DD)",
                    title: 'Expiry Date',
                    nullable: true,
                  },
                  additionalFields: {
                    type: Type.ARRAY,
                    description:
                      'Additional fields found on the document that do not fit standard categories',
                    title: 'Additional Fields',
                    nullable: true,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        fieldName: {
                          type: Type.STRING,
                          description: 'Name of the field',
                          title: 'Field Name',
                        },
                        fieldValue: {
                          type: Type.STRING,
                          description: 'Value of the field',
                          title: 'Field Value',
                        },
                      },
                    },
                  },
                  securityQuestions: {
                    type: Type.ARRAY,
                    description:
                      'Security questions and answers derived from document content',
                    title: 'Security Questions',
                    nullable: true,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: {
                          type: Type.STRING,
                          title: 'Question',
                          description: 'Security question',
                        },
                        answer: {
                          type: Type.STRING,
                          title: 'Answer',
                          description: 'Answer to the question',
                        },
                      },
                    },
                  },
                },
              },
              confidence: {
                type: Type.OBJECT,
                properties: {
                  serialNumber: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for serial number if found else null',
                    title: 'Serial Number',
                    nullable: true,
                  },
                  documentNumber: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for document number if found else null',
                    title: 'Document Number',
                    nullable: true,
                  },
                  batchNumber: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for batch number if found else null',
                    title: 'Batch Number',
                    nullable: true,
                  },
                  issuer: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for issuer if found else null',
                    title: 'Issuer',
                    nullable: true,
                  },
                  ownerName: {
                    type: Type.NUMBER,
                    description:
                      "Confidence score for owner's name if found else null",
                    title: 'Owner Name',
                    nullable: true,
                  },
                  dateOfBirth: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for date of birth if found else null',
                    title: 'Date of Birth',
                    nullable: true,
                  },
                  placeOfBirth: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for place of birth if found else null',
                    title: 'Place of Birth',
                    nullable: true,
                  },
                  placeOfIssue: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for place of issue if found else null',
                    title: 'Place of Issue',
                    nullable: true,
                  },
                  gender: {
                    type: Type.NUMBER,
                    description:
                      "Confidence score for owner's gender if found else null",
                    title: 'Gender',
                    nullable: true,
                  },
                  typeId: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for document type identifier if found else null',
                    title: 'Type ID',
                    nullable: true,
                  },
                  issuanceDate: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for issuance date if found else null',
                    title: 'Issuance Date',
                    nullable: true,
                  },
                  expiryDate: {
                    type: Type.NUMBER,
                    description:
                      'Confidence score for expiry date if found else null',
                    title: 'Expiry Date',
                    nullable: true,
                  },
                  additionalFields: {
                    type: Type.ARRAY,
                    description:
                      'Additional fields found on the document that do not fit standard categories if found else null',
                    title: 'Additional Fields',
                    nullable: true,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        fieldName: {
                          type: Type.STRING,
                          description: 'Name of the field',
                          title: 'Field Name',
                          nullable: true,
                        },
                        nameScore: {
                          type: Type.NUMBER,
                          description:
                            'Confidence score for the field name if found else null',
                          title: 'Field Name Score',
                          nullable: true,
                        },
                        fieldValue: {
                          type: Type.STRING,
                          description: 'Value of the field',
                          title: 'Field Value',
                          nullable: true,
                        },
                        valueScore: {
                          type: Type.NUMBER,
                          description:
                            'Confidence score for the field value if found else null',
                          title: 'Field Value Score',
                          nullable: true,
                        },
                      },
                    },
                  },
                  securityQuestions: {
                    type: Type.ARRAY,
                    description:
                      'Security questions and answers derived from document content',
                    title: 'Security Questions',
                    nullable: true,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: {
                          type: Type.STRING,
                          title: 'Question',
                          description: 'Security question',
                          nullable: true,
                        },
                        questionScore: {
                          type: Type.NUMBER,
                          description:
                            'Confidence score for the question if found else null',
                          title: 'Question Score',
                          nullable: true,
                        },
                        answer: {
                          type: Type.STRING,
                          title: 'Answer',
                          description: 'Answer to the question',
                          nullable: true,
                        },
                        answerScore: {
                          type: Type.NUMBER,
                          description:
                            'Confidence score for the answer if found else null',
                          title: 'Answer Score',
                          nullable: true,
                        },
                      },
                    },
                  },
                },
              },
              imageAnalysis: {
                type: Type.ARRAY,
                description: 'List of image analysis if found else null',
                title: 'Image Analysis',
                nullable: true,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: {
                      type: Type.NUMBER,
                      description: 'Index of the image if found else null',
                      title: 'Index',
                      nullable: true,
                    },
                    imageType: {
                      type: Type.STRING,
                      description: 'Type of the image if found else null',
                      title: 'Image Type',
                      nullable: true,
                    },
                    quality: {
                      type: Type.NUMBER,
                      description:
                        '0-1 score for image quality if found else null',
                      title: 'Quality',
                      nullable: true,
                    },
                    readability: {
                      type: Type.NUMBER,
                      description:
                        '0-1 score for text readability if found else null',
                      title: 'Readability',
                      nullable: true,
                    },
                    tamperingDetected: {
                      type: Type.BOOLEAN,
                      description:
                        'true if tampering detected in the image if found else null',
                      title: 'Tampering Detected',
                      nullable: true,
                    },
                    warnings: {
                      type: Type.ARRAY,
                      description:
                        'List of warnings about the image if found else null',
                      title: 'Warnings',
                      nullable: true,
                      items: {
                        type: Type.STRING,
                        description:
                          'Warning about the image if found else null',
                        title: 'Warning',
                        nullable: true,
                      },
                    },
                  },
                },
              },
            },
            // required: ['ownerName'],
          },
        },
      });

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
          aiModel: this.options.model,
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
          aiModel: this.options.model,
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

  private cleanResponseText(responseText: string) {
    return responseText
      .trim()
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '');
  }

  private async extractInformationFromInteraction(
    aiInteraction: AIInteraction,
  ) {
    try {
      const aiResponse = nullToUndefined<Record<string, any>>(
        JSON.parse(this.cleanResponseText(aiInteraction.response)) as Record<
          string,
          any
        >,
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
    const aiInteraction = await this.scan(input);
    return await this.extractInformationFromInteraction(aiInteraction);
  }

  async matchDocuments(
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
  ): Promise<{ confidence: number; reasons: string[] }> {
    const prompt = this.getMatchingPrompt(foundCase, lostCase);
    const response = await this.genai.models.generateContent({
      model: this.options.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        maxOutputTokens: 2048,
      },
    });
    const responseText = response.text!;
    const matchResult = JSON.parse(responseText) as {
      confidence: number;
      reasons: string[];
    };
    return matchResult;
  }
}
