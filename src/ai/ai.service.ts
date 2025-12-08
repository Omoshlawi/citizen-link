import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { AIOptions } from './ai.types';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';
import {
  DocumentCase,
  DocumentField,
  DocumentType,
  Document,
} from '../../generated/prisma/client';
import { DocAiExtractDto, DocAiExtractSchema } from './ocr.dto';

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

  private getExtractionPrompt(
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
  "nationality": string,
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
  nationality: z.string().optional(),
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
     "nationality": "USA",
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
          "question": "What is the nationality of the owner?",
          "answer": "USA"
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
${extractedText}`;
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
    - nationality: Should match exactly
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
        "nationality": {
          "match": <boolean>,
          "similarity": <number 0-100>,
          "note": "<brief explanation if mismatch>"
        }
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

  async extractInformation(extractedText: string): Promise<DocAiExtractDto> {
    try {
      const documentTypes = await this.prismaService.documentType.findMany({
        select: {
          id: true,
          name: true,
          category: true,
        },
      });
      const prompt = this.getExtractionPrompt(extractedText, documentTypes);
      const response = await this.genai.models.generateContent({
        model: this.options.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.1, // Low temperature for more deterministic outputs
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
      });
      const responseText = response.text!;
      // Parse JSON from the response
      const extractedInfo = JSON.parse(responseText) as Record<string, any>;
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
