import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AI_OPTIONS_TOKEN } from './ai.contants';
import { AIOptions } from './ai.types';

@Injectable()
export class AiMatchingService implements OnModuleInit {
  private readonly logger = new Logger(AiMatchingService.name);
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
