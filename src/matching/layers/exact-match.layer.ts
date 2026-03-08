import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CandidateMatch,
  ExactMatchResult,
  FindMatchesOptions,
  MatchedField,
  MatchingOptions,
} from '../matching.interface';
import { Document, DocumentType } from '../../../generated/prisma/client';
import {
  EXACT_FIELD_WEIGHTS,
  MATCHING_OPTIONS_TOKEN,
  OCR_CONFUSION_PAIRS,
} from '../matching.constants';
import { distance as levenshteinDistance } from 'fastest-levenshtein';

@Injectable()
export class ExactMatchLayer {
  private readonly logger = new Logger(ExactMatchLayer.name);

  constructor(
    @Inject(MATCHING_OPTIONS_TOKEN)
    private readonly matchingOptions: MatchingOptions,
  ) {}

  score(
    triggerDoc: Document & { type: DocumentType },
    candidates: CandidateMatch[],
    options?: FindMatchesOptions,
  ): ExactMatchResult[] {
    const threshold =
      options?.exactMatchThreshold ?? this.matchingOptions.exactMatchThreshold;

    this.logger.debug(
      `Layer 2 — exact matching ${candidates.length} candidates | ` +
        `threshold: ${threshold}`,
    );

    const results: ExactMatchResult[] = candidates
      .map((candidateDoc) => this.scoreOne(triggerDoc, candidateDoc))
      .filter((r) => {
        const passes = r.exactScore >= threshold;
        if (!passes) {
          this.logger.debug(
            `Layer 2 — candidateDoc ${r.candidateDoc.fullName} eliminated | ` +
              `exactScore: ${r.exactScore} < threshold: ${threshold}`,
          );
        }
        return passes;
      });

    this.logger.debug(
      `Layer 2 — ${results.length} candidates survived exact threshold`,
    );

    if (results.length > 0) {
      this.logger.debug(
        `Layer 2 — top candidate: ${results[0].candidateDoc.fullName} | ` +
          `exactScore: ${results[0].exactScore}`,
      );
    }

    return results.sort((a, b) => b.exactScore - a.exactScore);
  }

  private scoreOne(
    triggerDoc: Document & { type: DocumentType },
    candidateDoc: CandidateMatch,
  ): ExactMatchResult {
    const matchedFields: MatchedField[] = [];
    let weightedScore = 0;

    // ─── Document number (weight: 0.40) ──────────────
    const docNumScore = this.compareWithOcrTolerance(
      triggerDoc.documentNumber,
      candidateDoc.documentNumber,
      false,
    );
    matchedFields.push({
      field: 'documentNumber',
      triggerValue: triggerDoc.documentNumber,
      candidateValue: candidateDoc.documentNumber,
      matched: docNumScore > 0,
      score: docNumScore,
    });
    weightedScore += docNumScore * EXACT_FIELD_WEIGHTS.documentNumber;

    // ─── Date of birth (weight: 0.25) ────────────────
    const dobScore = this.compareDates(
      triggerDoc.dateOfBirth,
      candidateDoc.dateOfBirth,
    );
    matchedFields.push({
      field: 'dateOfBirth',
      triggerValue: triggerDoc.dateOfBirth?.toISOString().split('T')[0] ?? null,
      candidateValue:
        candidateDoc.dateOfBirth?.toISOString().split('T')[0] ?? null,
      matched: dobScore > 0,
      score: dobScore,
    });
    weightedScore += dobScore * EXACT_FIELD_WEIGHTS.dateOfBirth;

    // ─── Full name (weight: 0.25) ───────────────────────
    const fullNameScore = this.compareWithOcrTolerance(
      triggerDoc.fullName,
      candidateDoc.fullName,
      true,
    );
    matchedFields.push({
      field: 'fullName',
      triggerValue: triggerDoc.fullName,
      candidateValue: candidateDoc.fullName,
      matched: fullNameScore > 0,
      score: fullNameScore,
    });
    weightedScore += fullNameScore * EXACT_FIELD_WEIGHTS.fullName;

    // ─── Serial number (weight: 0.10) ─────────────────
    const serialScore = this.compareWithOcrTolerance(
      triggerDoc.serialNumber,
      candidateDoc.serialNumber,
      false,
    );
    matchedFields.push({
      field: 'serialNumber',
      triggerValue: triggerDoc.serialNumber,
      candidateValue: candidateDoc.serialNumber,
      matched: serialScore > 0,
      score: serialScore,
    });
    weightedScore += serialScore * EXACT_FIELD_WEIGHTS.serialNumber;

    return {
      triggerDoc,
      candidateDoc,
      exactScore: parseFloat(weightedScore.toFixed(4)),
      matchedFields,
    };
  }

  // ─── Comparison helpers ────────────────────────────

  private compareWithOcrTolerance(
    a: string | null | undefined,
    b: string | null | undefined,
    loose: boolean = false,
  ): number {
    // Both null — field not present on either side, do not penalise
    if (!a && !b) return 0;

    // One side null — field missing, cannot compare, do not penalise
    if (!a || !b) return 0;

    const normA = loose ? this.normaliseLoose(a) : this.normalise(a);
    const normB = loose ? this.normaliseLoose(b) : this.normalise(b);

    // Exact match after normalisation
    if (normA === normB) return 1.0;

    // Check if difference is explainable by known OCR confusion pairs
    const ocrCorrectedA = this.applyOcrCorrections(normA);
    const ocrCorrectedB = this.applyOcrCorrections(normB);

    if (ocrCorrectedA === ocrCorrectedB) return 0.9; // OCR confusion pair explains difference

    // Levenshtein distance — catch remaining OCR errors
    const distance = levenshteinDistance(normA, normB);

    if (distance === 1) return 0.85; // one char off — likely OCR error
    if (distance === 2) return 0.65; // two chars off — possible OCR error

    return 0; // too different — not the same
  }

  private compareDates(
    a: Date | null | undefined,
    b: Date | null | undefined,
  ): number {
    if (!a && !b) return 0;
    if (!a || !b) return 0;

    // Dates are unambiguous — strict equality only, no fuzzy matching
    return a.toISOString().split('T')[0] === b.toISOString().split('T')[0]
      ? 1.0
      : 0;
  }

  /**
   * Normalise a string for exact comparison (removes spaces)
   * Good for document numbers and serial numbers.
   * @param value The string to normalise
   * @returns The normalise string
   */
  private normalise(value: string): string {
    return value
      .normalize('NFD') // split accents first, before any casing
      .replace(/[\u0300-\u036f]/g, '') // strip accent marks
      .toLowerCase() // then lowercase (cheaper after NFD)
      .replace(/[^a-z0-9]/g, ''); // strip everything non-alphanumeric
  }

  /**
   * Normalise a string for loose comparison (keeps spaces)
   * Good for names where word boundaries matter.
   * If sort is true, the string will be sorted by word.
   * Comparing full names with normaliseLoose means word order matters.
   * JOHN ODHIAMBO vs ODHIAMBO JOHN would score poorly despite being the same person
   * @param value The string to normalise
   * @param sort Whether to sort the string by word
   * @returns The normalise string
   */
  private normaliseLoose(value: string, sort: boolean = true): string {
    const normValue = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // keeps spaces
      .replace(/\s+/g, ' ')
      .trim();
    if (sort) return normValue.split(' ').sort().join(' ');
    return normValue;
  }

  // Replace known OCR confusion chars with a canonical form for comparison
  private applyOcrCorrections(value: string): string {
    let result = value;
    for (const [a, b] of OCR_CONFUSION_PAIRS) {
      // Normalise both confused chars to the first of the pair
      result = result.replaceAll(b, a);
    }
    return result;
  }
}
