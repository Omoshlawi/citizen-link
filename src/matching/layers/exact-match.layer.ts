import { Injectable, Logger } from '@nestjs/common';
import {
  CandidateMatch,
  ExactMatchResult,
  FindMatchesOptions,
  MatchedField,
} from '../matching.interface';
import { Document, DocumentType } from '../../../generated/prisma/client';
import {
  EXACT_FIELD_WEIGHTS,
  OCR_CONFUSION_PAIRS,
} from '../matching.constants';

@Injectable()
export class ExactMatchLayer {
  private readonly logger = new Logger(ExactMatchLayer.name);

  score(
    triggerDoc: Document & { type: DocumentType },
    candidates: CandidateMatch[],
    options?: FindMatchesOptions,
  ): ExactMatchResult[] {
    const threshold = options?.exactMatchThreshold ?? 0.4;

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

    // ─── Surname (weight: 0.15) ───────────────────────
    const surnameScore = this.compareWithOcrTolerance(
      triggerDoc.surname,
      candidateDoc.surname,
    );
    matchedFields.push({
      field: 'surname',
      triggerValue: triggerDoc.surname,
      candidateValue: candidateDoc.surname,
      matched: surnameScore > 0,
      score: surnameScore,
    });
    weightedScore += surnameScore * EXACT_FIELD_WEIGHTS.surname;

    // ─── Document type (weight: 0.10) ─────────────────
    const typeScore = triggerDoc.typeId === candidateDoc.typeId ? 1.0 : 0;
    matchedFields.push({
      field: 'documentTypeCode',
      triggerValue: triggerDoc.typeId,
      candidateValue: candidateDoc.typeId,
      matched: typeScore > 0,
      score: typeScore,
    });
    weightedScore += typeScore * EXACT_FIELD_WEIGHTS.documentTypeCode;

    // ─── Serial number (weight: 0.10) ─────────────────
    const serialScore = this.compareWithOcrTolerance(
      triggerDoc.serialNumber,
      candidateDoc.serialNumber,
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
  ): number {
    // Both null — field not present on either side, do not penalise
    if (!a && !b) return 0;

    // One side null — field missing, cannot compare, do not penalise
    if (!a || !b) return 0;

    const normA = this.normalise(a);
    const normB = this.normalise(b);

    // Exact match after normalisation
    if (normA === normB) return 1.0;

    // Check if difference is explainable by known OCR confusion pairs
    const ocrCorrectedA = this.applyOcrCorrections(normA);
    const ocrCorrectedB = this.applyOcrCorrections(normB);

    if (ocrCorrectedA === ocrCorrectedB) return 0.9; // OCR confusion pair explains difference

    // Levenshtein distance — catch remaining OCR errors
    const distance = this.levenshtein(normA, normB);

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

  private normalise(value: string): string {
    return value.toUpperCase().trim().replace(/\s+/g, ' ');
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

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) =>
        i === 0 ? j : j === 0 ? i : 0,
      ),
    );

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        matrix[i][j] =
          a[i - 1] === b[j - 1]
            ? matrix[i - 1][j - 1]
            : 1 +
              Math.min(
                matrix[i - 1][j],
                matrix[i][j - 1],
                matrix[i - 1][j - 1],
              );
      }
    }

    return matrix[a.length][b.length];
  }
}
