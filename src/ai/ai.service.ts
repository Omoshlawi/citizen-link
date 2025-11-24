/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AIOptions } from './ai.types';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AiService implements OnModuleInit {
  private genai: GoogleGenAI;
  constructor(
    @Inject(AI_OPTIONS_TOKEN)
    private readonly options: AIOptions,
  ) {}
  onModuleInit() {
    this.genai = new GoogleGenAI({
      apiKey: this.options.googleApiKey,
    });
  }

  private getPrompt(extractedText: string) {
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
  "serialNumber": string or null,
  "documentNumber": string or null,
  "batchNumber": string or null,
  "issuer": string or null,
  "ownerName": string,
  "dateOfBirth": string or null, // Format as ISO date string (YYYY-MM-DD)
  "placeOfBirth": string or null,
  "placeOfIssue": string or null,
  "gender": "Male" or "Female" or "Unknown" or null,
  "nationality": string or null,
  "bloodGroup": string or null,
  "note": string or null,
  "typeId": string, // Document type (e.g., "passport", "driver_license", etc.)
  "issuanceDate": string or null, // Format as ISO date string (YYYY-MM-DD)
  "expiryDate": string or null, // Format as ISO date string (YYYY-MM-DD)
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
     "typeId": "passport",
     "issuanceDate": "2020-01-01",
     "expiryDate": "2030-01-01",
     "nationality": "USA",
     "additionalFields": []
   }

2. For poorly OCR'd driver's license: "DRlVER LlCENSE / STATE 0F EXAMPLE / DL#: Dl234567 / JANE D0E / l23 MAlN ST, ANYT0WN / D0B: O2/l5/l985 / EXP: O6/3O/2O26 / CLASS: C"
   Return: {
     "documentNumber": "D1234567",
     "issuer": "STATE OF EXAMPLE",
     "ownerName": "JANE DOE",
     "dateOfBirth": "1985-02-15",
     "typeId": "driver_license",
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
     ]
   }

TEXT TO ANALYZE (OCR-EXTRACTED):
${extractedText}`;
  }

  async extractInformation(extractedText: string) {
    try {
      const prompt = this.getPrompt(extractedText);
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
      const extractedInfo = JSON.parse(responseText as string) as Record<
        string,
        any
      >;

      // Return the structured information or empty object if nothing extracted
      return extractedInfo || {};
    } catch (error) {
      console.error('Error extracting information:', error);
      throw error;
    }
  }
}
