import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AIInteraction,
  AIInteractionType,
  Document,
  DocumentCase,
  DocumentField,
  DocumentType,
} from '../../generated/prisma/client';
import { AiService } from '../ai/ai.service';
import { safeParseJson } from '../app.utils';
import { MatchResultDto, MatchResultSchema } from './matching.dto';
@Injectable()
export class MatchingVerifierService {
  private readonly logger = new Logger(MatchingVerifierService.name);
  constructor(private readonly aiService: AiService) {}

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
    const foundTags = (foundCase.tags as Array<string>).length
      ? (foundCase.tags as Array<string>).join(', ')
      : null;
    const lostTags = (lostCase.tags as Array<string>).length
      ? (lostCase.tags as Array<string>).join(', ')
      : null;
    const prompt = `You are a document matching expert. Your task is to analyze two documents and determine if they belong to the same person.
            
      ## Documents to Compare
              
      ### FOUND DOCUMENT:
      - Keywords/Tags: ${foundTags || 'None'}
      - Document Number: ${foundCase.document.documentNumber || 'Not provided'}
      - Serial Number: ${foundCase.document.serialNumber || 'Not provided'}
      - Batch Number: ${foundCase.document.batchNumber || 'Not provided'}
      - Date of birth: ${foundCase.document.dateOfBirth?.toISOString() || 'Not provided'}
      - Place of birth: ${foundCase.document.placeOfBirth || 'Not provided'}
      - Gender: ${foundCase.document.gender || 'Not provided'}
      - Owner name: ${foundCase.document.ownerName || 'Not provided'}
      - Issuer: ${foundCase.document.issuer || 'Not provided'}
      - Document Type: ${foundCase.document.type.name}
      - Date of Issue: ${foundCase.document.issuanceDate?.toISOString() || 'Not provided'}
      - Place of Issue: ${foundCase.document.placeOfIssue || 'Not provided'}
      - Date of expiry: ${foundCase.document.expiryDate?.toISOString() || 'Not provided'}
      ${
        foundCase.document.additionalFields.length > 0
          ? '\n**Additional Fields:**\n' +
            foundCase.document.additionalFields
              .map((f) => '- ' + f.fieldName + ': ' + f.fieldValue)
              .join('\n')
          : ''
      }
      
      ### LOST DOCUMENT:
      - Keywords/Tags: ${lostTags || 'None'}
      - Document Number: ${lostCase.document.documentNumber || 'Not provided'}
      - Serial Number: ${lostCase.document.serialNumber || 'Not provided'}
      - Batch Number: ${lostCase.document.batchNumber || 'Not provided'}
      - Date of birth: ${lostCase.document.dateOfBirth?.toISOString() || 'Not provided'}
      - Place of birth: ${lostCase.document.placeOfBirth || 'Not provided'}
      - Gender: ${lostCase.document.gender || 'Not provided'}
      - Owner name: ${lostCase.document.ownerName || 'Not provided'}
      - Issuer: ${lostCase.document.issuer || 'Not provided'}
      - Document Type: ${lostCase.document.type.name}
      - Date of Issue: ${lostCase.document.issuanceDate?.toISOString() || 'Not provided'}
      - Place of Issue: ${lostCase.document.placeOfIssue || 'Not provided'}
      - Date of expiry: ${lostCase.document.expiryDate?.toISOString() || 'Not provided'}
      ${
        lostCase.document.additionalFields.length > 0
          ? '\n**Additional Fields:**\n' +
            lostCase.document.additionalFields
              .map((f) => '- ' + f.fieldName + ': ' + f.fieldValue)
              .join('\n')
          : ''
      }
      
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
      
      **CONTEXTUAL INDICATORS (Supporting Evidence):**
      - keywords/tags: User-provided descriptive terms about the document or circumstances
        * These provide contextual clues (e.g., "found near bus station", "blue wallet", "damaged corner")
        * Overlapping tags suggest similar context/location but are NOT identity markers
        * Use as supporting evidence, not primary matching criteria
        * Missing or different tags should NOT penalize the match score significantly
        * Example: If documents have matching critical fields but different tags, tags should not reduce confidence
      
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
          - Tags: Treat as contextual supporting evidence, not identity proof
      
      3. **Identify red flags:**
          - Critical fields that conflict (e.g., different gender, vastly different DOB)
          - Suspicious exact matches (e.g., identical rare typos suggesting copy)
          - Impossible scenarios (e.g., document issued before birth)
          - Note: Different tags are NOT a red flag - focus on document content
      
      4. **Weight your analysis:**
          - Strong matches in critical fields = high confidence (tags are bonus, not requirement)
          - Many moderate matches = medium confidence
          - Only weak field matches = low confidence
          - Any red flags in critical/strong fields = significantly reduce confidence
          - Overlapping tags = slight confidence boost, different tags = no penalty
      
      ## Tag Analysis Guidelines
      
      **How to use keywords/tags in matching:**
      
      1. **As Confirmation**: If critical fields match strongly, similar tags provide additional confidence
      2. **As Context**: Tags can explain circumstances (location, condition) but don't identify the person
      3. **Not as Rejection Criteria**: Different or missing tags should NOT disqualify otherwise strong matches
      4. **Overlap Benefits**: 
         - 50%+ tag overlap = slight confidence boost (+2-5 points)
         - Some overlap = neutral
         - No overlap = neutral (not negative)
      
      **Examples of tag interpretation:**
      - "found at market" vs "lost near market" → Supportive context
      - "blue folder" vs "red envelope" → Different containers, same document possible
      - "water damaged" vs "torn corner" → Both indicate damage, consistent
      - No tags vs many tags → No penalty for missing tags
      
      ## Required Output Format
      
      You MUST respond with valid JSON in this exact structure:
      
      {
          "overallScore": <number 0-100>,
          "confidence": "<HIGH|MEDIUM|LOW|NO_MATCH>",
          "recommendation": "<SAME_PERSON|LIKELY_SAME|POSSIBLY_SAME|DIFFERENT_PERSON>",
          "reasoning": "<2-3 sentence explanation of your decision>",
          "fieldAnalysis": [
              {
                  "fieldName": "<field name>",
                  "match": <boolean>,
                  "confidence": <number 0-100>,
                  "note": "<optional note>"
              }
          ],
          "tagAnalysis": {
              "overlap": <number 0-100 percentage>,
              "overlappingTags": [<array of matching tags>],
              "interpretation": "<brief note on how tags support or don't affect the match>"
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
      
      **Tag scoring impact:**
      - High tag overlap on strong match: +2 to +5 points (subtle boost)
      - Low/no tag overlap: 0 points (neutral, no penalty)
      - Tags should never be the primary reason for match/no-match decision
      
      ## Confidence Levels
      
      - **HIGH**: 80-100 score, recommend as SAME_PERSON or LIKELY_SAME
      - **MEDIUM**: 60-79 score, recommend as LIKELY_SAME or POSSIBLY_SAME
      - **LOW**: 40-59 score, recommend as POSSIBLY_SAME
      - **NO_MATCH**: 0-39 score, recommend as DIFFERENT_PERSON
      
      ## Important Notes
      
      - Missing fields should NOT be treated as mismatches - only compare fields that exist in both documents
      - **Tags are descriptive context, not identity proof** - weight them accordingly
      - Consider that the same person may have multiple document types (passport, ID, license)
      - Be culturally sensitive to name variations across different regions
      - Account for time gaps - a person's documents from different years are still the same person
      - OCR errors are common - be generous with minor character differences
      - When in doubt, err on the side of flagging for human review rather than making a definitive call
      
      Now analyze the two documents above and provide your response in the required JSON format.`;

    return prompt;
  }

  /**
   * Use LLM to verify if two documents match
   */
  async verifyMatch(
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
    userId: string,
  ): Promise<{ matchData: MatchResultDto; aiInteraction: AIInteraction }> {
    const prompt = this.getMatchingPrompt(foundCase, lostCase);
    const matchResult = await this.aiService.callAIAndStore(
      prompt,
      [],
      AIInteractionType.DOCUMENT_MATCHING,
      'Match',
      userId,
    );

    if (!matchResult.success) {
      this.logger.error(`Failed to verify match: ${matchResult.errorMessage}`);
      throw new BadRequestException(
        `Failed to verify match: ${matchResult.errorMessage}`,
      );
    }

    const cleanedResponse = this.aiService.cleanResponseText(
      matchResult.response,
    );

    const matchResultParsed = safeParseJson<{
      confidence: number;
      reasons: string[];
    }>(cleanedResponse, { transformNullToUndefined: true });

    if (!matchResultParsed.success) {
      this.logger.error(
        `Failed to parse match result: ${matchResultParsed.error.message}`,
      );
      throw new BadRequestException(
        `Failed to parse match result: ${matchResultParsed.error.message}`,
      );
    }

    const matchValidation = await MatchResultSchema.safeParseAsync(
      matchResultParsed.data,
    );

    if (!matchValidation.success) {
      this.logger.error(
        `Failed to validate match result: ${matchValidation.error.message}`,
      );
      throw new BadRequestException(
        `Failed to validate match result: ${matchValidation.error.message}`,
      );
    }

    const matchData = matchValidation.data;
    this.logger.log(`Match result: ${JSON.stringify(matchData, null, 2)}`);

    return { matchData, aiInteraction: matchResult };
  }
}
